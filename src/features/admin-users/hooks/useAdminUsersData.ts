import { useQuery } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { computePaymentSummaryMetrics } from "@/lib/payments/metrics";
import { resolveMembershipStatus } from "@/lib/membershipStatus";
import type {
  AdminUserAccount,
  AdminUserLeadSummary,
  AdminUserPackageSummary,
  AdminUserPaymentSummary,
  AdminUserProjectSummary,
  AdminUserServiceSummary,
  AdminUserSessionSummary,
  AdminUserSessionTypeSummary,
  AdminUserSocialChannel,
  MembershipStatus,
} from "../types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type OrganizationSettingsRow = Database["public"]["Tables"]["organization_settings"]["Row"];
type MembershipEventRow = Database["public"]["Tables"]["membership_events"]["Row"];

const getFirstError = (...results: Array<{ error: unknown | null }>) =>
  results.find((result) => result.error)?.error ?? null;

const groupByOrganization = <T extends { organization_id?: string | null }>(
  rows: T[] | null | undefined
): Record<string, T[]> => {
  return (rows ?? []).reduce<Record<string, T[]>>((acc, row) => {
    if (!row.organization_id) return acc;
    if (!acc[row.organization_id]) {
      acc[row.organization_id] = [];
    }
    acc[row.organization_id].push(row);
    return acc;
  }, {});
};

const computeLastActiveAt = (
  org: OrganizationRow,
  ...collections: Array<Array<{ updated_at?: string | null; created_at?: string | null }> | undefined>
): string => {
  const timestamps: string[] = [org.updated_at, org.created_at].filter(Boolean) as string[];
  collections.forEach((collection) => {
    collection?.forEach((item) => {
      if (item.updated_at) timestamps.push(item.updated_at);
      else if (item.created_at) timestamps.push(item.created_at);
    });
  });
  if (!timestamps.length) {
    return new Date().toISOString();
  }
  return timestamps.reduce((latest, current) => {
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  });
};

const MEMBERSHIP_PLAN_LABELS: Record<MembershipStatus, string> = {
  trial: "Trial",
  premium: "Premium",
  expired: "Trial expired",
  suspended: "Suspended",
  complimentary: "Complimentary",
  locked: "Locked",
};

const SOCIAL_LABEL_OVERRIDES: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  twitter: "x.com (Twitter)",
  x: "x.com (Twitter)",
};

const prettifySocialLabel = (key: string): string => {
  if (!key) return "";
  const normalized = key.toLowerCase();
  if (SOCIAL_LABEL_OVERRIDES[normalized]) {
    return SOCIAL_LABEL_OVERRIDES[normalized];
  }
  const customMatch = normalized.match(/^custom[_-](.+)$/);
  const labelSource = customMatch ? customMatch[1] : key;
  return labelSource
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

const parseSocialChannels = (raw: unknown): AdminUserSocialChannel[] => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).reduce<AdminUserSocialChannel[]>(
    (acc, [key, value]) => {
      if (value == null) return acc;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return acc;
        acc.push({
          key,
          label: prettifySocialLabel(key),
          url: trimmed,
        });
        return acc;
      }
      if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const maybeUrl =
          typeof obj.url === "string"
            ? obj.url
            : typeof obj.value === "string"
            ? obj.value
            : "";
        const trimmed = maybeUrl.trim();
        if (!trimmed) return acc;
        const maybeLabel = typeof obj.label === "string" ? obj.label : "";
        acc.push({
          key,
          label: maybeLabel.trim() || prettifySocialLabel(key),
          url: trimmed,
        });
      }
      return acc;
    },
    []
  );
};

interface FetchAdminAccountsOptions {
  userId: string;
  isAdmin: boolean;
}

const fetchAdminAccounts = async ({
  userId,
  isAdmin,
}: FetchAdminAccountsOptions): Promise<AdminUserAccount[]> => {
  if (!userId) {
    return [];
  }

  let organizationsQuery = supabase
    .from("organizations")
    .select(
      [
        "id",
        "name",
        "owner_id",
        "created_at",
        "updated_at",
        "membership_status",
        "trial_started_at",
        "trial_expires_at",
        "trial_extended_by_days",
        "trial_extension_reason",
        "premium_activated_at",
        "premium_plan",
        "premium_expires_at",
        "manual_flag",
        "manual_flag_reason",
      ].join(", ")
    )
    .order("created_at", { ascending: true });

  if (!isAdmin) {
    const membershipsResult = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);

    if (membershipsResult.error) {
      throw membershipsResult.error;
    }

    const organizationIds = (membershipsResult.data ?? [])
      .map((membership) => membership.organization_id)
      .filter((id): id is string => Boolean(id));

    if (organizationIds.length > 0) {
      organizationsQuery = organizationsQuery.in("id", organizationIds);
    } else {
      organizationsQuery = organizationsQuery.eq("owner_id", userId);
    }
  }

  const organizationsResult = await organizationsQuery;
  if (organizationsResult.error) {
    throw organizationsResult.error;
  }

  const organizations = organizationsResult.data ?? [];
  if (!organizations.length) {
    return [];
  }

  const organizationIds = organizations.map((organization) => organization.id);

  const [
    profilesResult,
    paymentsResult,
    organizationSettingsResult,
    leadsResult,
    projectsResult,
    sessionsResult,
    templatesResult,
    workflowsResult,
    packagesResult,
    servicesResult,
    sessionTypesResult,
    leadStatusesResult,
    projectStatusesResult,
    membershipEventsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name"),
    supabase
      .from("payments")
      .select(
        [
          "id",
          "amount",
          "status",
          "entry_kind",
          "type",
          "description",
          "date_paid",
          "created_at",
          "updated_at",
          "organization_id",
          "project_id",
          "user_id",
          "scheduled_initial_amount",
          "scheduled_remaining_amount",
        ].join(", ")
      )
      .in("organization_id", organizationIds),
    supabase
      .from("organization_settings")
      .select(
        "organization_id, email, phone, photography_business_name, social_channels, timezone"
      )
      .in("organization_id", organizationIds),
    supabase
      .from("leads")
      .select(
        [
          "id",
          "organization_id",
          "name",
          "email",
          "phone",
          "status",
          "status_id",
          "due_date",
          "created_at",
          "updated_at",
          "user_id",
        ].join(", ")
      )
      .in("organization_id", organizationIds),
    supabase
      .from("projects")
      .select(
        [
          "id",
          "organization_id",
          "name",
          "lead_id",
          "base_price",
          "status_id",
          "created_at",
          "updated_at",
          "user_id",
        ].join(", ")
      )
      .in("organization_id", organizationIds),
    supabase
      .from("sessions")
      .select(
        [
          "id",
          "organization_id",
          "status",
          "session_name",
          "session_date",
          "session_time",
          "project_id",
          "session_type_id",
          "lead_id",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .in("organization_id", organizationIds),
    supabase.from("message_templates").select("id, organization_id").in("organization_id", organizationIds),
    supabase.from("workflows").select("id, organization_id").in("organization_id", organizationIds),
    supabase.from("packages").select("id, organization_id").in("organization_id", organizationIds),
    supabase.from("services").select("id, organization_id").in("organization_id", organizationIds),
    supabase.from("session_types").select("id, organization_id").in("organization_id", organizationIds),
    supabase
      .from("lead_statuses")
      .select("id, lifecycle, is_system_final, name")
      .in("organization_id", organizationIds),
    supabase
      .from("project_statuses")
      .select("id, lifecycle, name")
      .in("organization_id", organizationIds),
    supabase
      .from("membership_events")
      .select("id, organization_id, admin_id, action, metadata, previous_status, new_status, created_at")
      .in("organization_id", organizationIds)
      .order("created_at", { ascending: false })
  ]);

  const isMembershipEventsTableMissing =
    membershipEventsResult.error &&
    typeof membershipEventsResult.error === "object" &&
    "code" in membershipEventsResult.error &&
    (membershipEventsResult.error as { code?: string }).code === "PGRST205";

  const safeMembershipEventsResult = isMembershipEventsTableMissing
    ? { ...membershipEventsResult, error: null, data: [] as MembershipEventRow[] }
    : membershipEventsResult;

  if (isMembershipEventsTableMissing) {
    console.warn("membership_events table missing; continuing without historical membership data.");
  }

  const firstError = getFirstError(
    profilesResult,
    paymentsResult,
    organizationSettingsResult,
    leadsResult,
    projectsResult,
    sessionsResult,
    templatesResult,
    workflowsResult,
    packagesResult,
    servicesResult,
    sessionTypesResult,
    leadStatusesResult,
    projectStatusesResult,
    safeMembershipEventsResult
  );
  if (firstError) {
    throw firstError;
  }

  const organizationSettingsData = organizationSettingsResult.error
    ? []
    : organizationSettingsResult.data ?? [];
  const organizationSettingsMap = new Map(
    organizationSettingsData.map((settings) => [settings.organization_id, settings])
  );

  const profileMap = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.user_id, profile])
  );
  const paymentsByOrg = groupByOrganization(paymentsResult.data);
  const leadsByOrg = groupByOrganization(leadsResult.data);
  const allProjects = projectsResult.data ?? [];
  const projectsByOrg = groupByOrganization(allProjects);
  const sessionsByOrg = groupByOrganization(sessionsResult.data);
  const templatesByOrg = groupByOrganization(templatesResult.data);
  const workflowsByOrg = groupByOrganization(workflowsResult.data);
  const packagesByOrg = groupByOrganization(packagesResult.data);
  const servicesByOrg = groupByOrganization(servicesResult.data);
  const sessionTypesByOrg = groupByOrganization(sessionTypesResult.data);
  const membershipEventsByOrg = groupByOrganization(safeMembershipEventsResult.data);
  const leadStatusMap = new Map(
    (leadStatusesResult.data ?? []).map((status) => [status.id, status])
  );
  const projectStatuses = projectStatusesResult.data ?? [];
  const projectStatusMap = new Map(projectStatuses.map((status) => [status.id, status]));
  const isArchivedStatusName = (name?: string | null) => {
    if (!name) return false;
    const normalized = name.toLowerCase();
    return normalized.includes("archive") || normalized.includes("arşiv");
  };
  const archivedProjectStatusIds = new Set(
    projectStatuses.filter((status) => isArchivedStatusName(status.name)).map((status) => status.id)
  );
  const archivedProjectsByOrg = allProjects.reduce<Record<string, Set<string>>>((acc, project) => {
    if (!project.organization_id || !project.status_id) {
      return acc;
    }
    if (!archivedProjectStatusIds.has(project.status_id)) {
      return acc;
    }
    if (!acc[project.organization_id]) {
      acc[project.organization_id] = new Set<string>();
    }
    acc[project.organization_id].add(project.id);
    return acc;
  }, {});

  type LifecycleState = "active" | "completed" | "cancelled";
  const normalizeLifecycle = (
    value?: string | null,
    options?: { isFinal?: boolean }
  ): LifecycleState => {
    if (!value) {
      return options?.isFinal ? "completed" : "active";
    }
    const normalized = value.toLowerCase();
    const includesAny = (keywords: string[]) =>
      keywords.some((keyword) => normalized.includes(keyword));

    if (
      includesAny([
        "cancel",
        "closed_lost",
        "lost",
        "declin",
        "aband",
        "fail",
        "not interested",
        "inactive",
        "void",
      ])
    ) {
      return "cancelled";
    }
    if (
      includesAny([
        "complete",
        "deliver",
        "finish",
        "done",
        "closed_won",
        "won",
        "fulfilled",
      ])
    ) {
      return "completed";
    }
    if (
      includesAny([
        "active",
        "progress",
        "plan",
        "booked",
        "confirm",
        "edit",
        "schedule",
        "open",
      ])
    ) {
      return "active";
    }
    if (options?.isFinal) {
      return "completed";
    }
    return "active";
  };


  return organizations.map<AdminUserAccount>((organization) => {
    const owner = profileMap.get(organization.owner_id) as ProfileRow | undefined;
    const settings = organizationSettingsMap.get(organization.id) as OrganizationSettingsRow | undefined;
    const organizationEmail = settings?.email ?? null;
    const archivedProjectIds = archivedProjectsByOrg[organization.id];
    const payments = (paymentsByOrg[organization.id] ?? []).filter((payment) => {
      if (!archivedProjectIds || !archivedProjectIds.size) return true;
      if (!payment.project_id) return true;
      return !archivedProjectIds.has(payment.project_id);
    });
    const leads = leadsByOrg[organization.id] ?? [];
    const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
    const projects = projectsByOrg[organization.id] ?? [];
    const sessions = sessionsByOrg[organization.id] ?? [];
    const templates = templatesByOrg[organization.id] ?? [];
    const workflows = workflowsByOrg[organization.id] ?? [];
    const packages = packagesByOrg[organization.id] ?? [];
    const services = servicesByOrg[organization.id] ?? [];
    const sessionTypes = sessionTypesByOrg[organization.id] ?? [];
    const sessionTypeMap = new Map(sessionTypes.map((sessionType) => [sessionType.id, sessionType]));
    const membershipEventsRaw = membershipEventsByOrg[organization.id] ?? [];
    const membershipEvents = membershipEventsRaw.slice(0, 25).map((event) => ({
      id: event.id,
      action: event.action,
      createdAt: event.created_at,
      adminId: event.admin_id ?? undefined,
      adminName: event.admin_id ? profileMap.get(event.admin_id)?.full_name ?? undefined : undefined,
      previousStatus: (event.previous_status ?? undefined) as MembershipStatus | undefined,
      newStatus: (event.new_status ?? undefined) as MembershipStatus | undefined,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
    }));
    const lastActiveAt = computeLastActiveAt(
      organization,
      leads,
      projects,
      sessions,
      templates,
      workflows,
      packages,
      services,
      sessionTypes,
      payments,
      membershipEventsRaw
    );
    const membershipResolution = resolveMembershipStatus(organization);
    const manualFlagReason = organization.manual_flag_reason?.trim() || null;
    const status = membershipResolution.status;
    const planName = MEMBERSHIP_PLAN_LABELS[status] ?? "Trial";
    const trialEndsAt = membershipResolution.trialEndsAt;
    const trialStartedAt =
      membershipResolution.trialStartedAt ??
      organization.trial_started_at ??
      organization.created_at ??
      new Date().toISOString();
    const trialDaysRemaining = membershipResolution.trialEndsAt
      ? Math.max(
          0,
          differenceInCalendarDays(
            new Date(membershipResolution.trialEndsAt),
            new Date()
          )
        )
      : 0;

    const collectedPayments = payments.filter((payment) => {
      if ((payment.entry_kind ?? "recorded") === "scheduled") {
        return false;
      }
      const status = payment.status?.toLowerCase() ?? "";
      if (status === "paid" && Number(payment.amount ?? 0) > 0) {
        return true;
      }
      return false;
    });
    const paymentMetrics = computePaymentSummaryMetrics(payments);
    const totalCollected = paymentMetrics.totalPaid;
    const totalBilled = paymentMetrics.totalInvoiced;
    const refundedTotal = paymentMetrics.totalRefunded;
    const paymentsLast30d = collectedPayments.reduce((sum, payment) => {
      if (!payment.date_paid) return sum;
      const paidDate = new Date(payment.date_paid);
      const threshold = addDays(new Date(), -30);
      if (paidDate >= threshold) {
        return sum + Math.abs(payment.amount ?? 0);
      }
      return sum;
    }, 0);
    const overdueBalance = paymentMetrics.remainingBalance;

    const businessSocialChannels = parseSocialChannels(settings?.social_channels);

    const leadLifecycleCounts = { active: 0, completed: 0, cancelled: 0 };
    leads.forEach((lead) => {
      const lifecycle = (() => {
        if (lead.status_id) {
          const meta = leadStatusMap.get(lead.status_id);
          return normalizeLifecycle(meta?.lifecycle ?? meta?.name ?? lead.status, {
            isFinal: meta?.is_system_final ?? undefined,
          });
        }
        return normalizeLifecycle(lead.status);
      })();
      leadLifecycleCounts[lifecycle] += 1;
    });

    const projectLifecycleCounts = { active: 0, completed: 0, cancelled: 0 };
    const projectSummaries = projects.map((project) => {
      const lifecycle = project.status_id
        ? normalizeLifecycle(
            projectStatusMap.get(project.status_id)?.lifecycle ??
              projectStatusMap.get(project.status_id)?.name
          )
        : "active";
      projectLifecycleCounts[lifecycle] += 1;
      return {
        ...project,
        status_label: project.status_id ? projectStatusMap.get(project.status_id)?.name ?? null : null,
        lead_name: project.lead_id ? leadsById.get(project.lead_id)?.name ?? null : null,
      };
    });

    const sessionLifecycleCounts = { active: 0, completed: 0, cancelled: 0 };
    const sessionSummaries = sessions.map((session) => {
      const lifecycle = normalizeLifecycle(session.status);
      sessionLifecycleCounts[lifecycle] += 1;
      return {
        ...session,
        session_type_label: session.session_type_id
          ? sessionTypeMap.get(session.session_type_id)?.name ?? null
          : null,
      };
    });

    return {
      id: organization.id,
      name: organization.name,
      email: organizationEmail ?? "",
      company: organization.name,
      status,
      planName,
      membershipStartedAt: trialStartedAt,
      premiumActivatedAt: organization.premium_activated_at ?? undefined,
      premiumPlan: organization.premium_plan ?? null,
      premiumExpiresAt: organization.premium_expires_at ?? null,
      trialEndsAt: trialEndsAt ?? undefined,
      trialDaysRemaining,
      trialExtendedByDays: organization.trial_extended_by_days ?? 0,
      trialExtensionReason: organization.trial_extension_reason ?? null,
      lastActiveAt,
      accountOwner: owner?.full_name ?? undefined,
      timezone: settings?.timezone ?? undefined,
      manualFlag: organization.manual_flag ?? false,
      manualFlagReason,
      business: {
        businessName: settings?.photography_business_name ?? organization.name,
        businessEmail: organizationEmail,
        businessPhone: settings?.phone ?? null,
        socialChannels: businessSocialChannels.length ? businessSocialChannels : undefined,
      },
      stats: {
        projects: projects.length,
        activeProjects: projectLifecycleCounts.active,
        completedProjects: projectLifecycleCounts.completed,
        cancelledProjects: projectLifecycleCounts.cancelled,
        leads: leads.length,
        activeLeads: leadLifecycleCounts.active,
        completedLeads: leadLifecycleCounts.completed,
        cancelledLeads: leadLifecycleCounts.cancelled,
        sessions: sessions.length,
        activeSessions: sessionLifecycleCounts.active,
        completedSessions: sessionLifecycleCounts.completed,
        cancelledSessions: sessionLifecycleCounts.cancelled,
        upcomingSessions: 0,
        calendarEvents: 0,
        payments: payments.length,
        teamMembers: 1,
        templates: templates.length,
        workflows: workflows.length,
        packages: packages.length,
        services: services.length,
        sessionTypes: sessionTypes.length,
      },
      financials: {
        monthlyRecurringRevenue: paymentsLast30d,
        lifetimeValue: totalCollected,
        totalBilled,
        totalCollected,
        refundedTotal,
        averageDealSize: collectedPayments.length
          ? Math.round(totalCollected / collectedPayments.length)
          : 0,
        overdueBalance,
      },
      detail: {
        leads: leads as AdminUserLeadSummary[],
        projects: projectSummaries as AdminUserProjectSummary[],
        sessions: sessionSummaries as AdminUserSessionSummary[],
        calendar: [],
        payments: payments as AdminUserPaymentSummary[],
        services: services as AdminUserServiceSummary[],
        packages: packages as AdminUserPackageSummary[],
        sessionTypes: sessionTypes as AdminUserSessionTypeSummary[],
        membershipEvents,
      },
    };
  });
};

export function useAdminUsersData() {
  const { user, userRoles, loading: authLoading } = useAuth();
  const isAdmin = userRoles.includes("admin");

  const query = useQuery({
    queryKey: ["admin-users", user?.id ?? "anon", userRoles.slice().sort().join("|")],
    queryFn: () => fetchAdminAccounts({ userId: user?.id ?? "", isAdmin }),
    staleTime: 60 * 1000,
    enabled: Boolean(user?.id) && !authLoading,
  });

  const users = query.data ?? [];
  return {
    users,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
