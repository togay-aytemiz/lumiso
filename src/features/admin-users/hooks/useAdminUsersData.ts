import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, isAfter, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  AdminUserAccount,
  AdminUserCalendarEventSummary,
  AdminUserPackageSummary,
  AdminUserPaymentSummary,
  AdminUserProjectSummary,
  AdminUserServiceSummary,
  AdminUserSessionSummary,
  AdminUserSessionTypeSummary,
  AdminUsersSummaryMetrics,
  MembershipStatus,
} from "../types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ProjectStatusRow = Database["public"]["Tables"]["project_statuses"]["Row"];
type SessionTypeRow = Database["public"]["Tables"]["session_types"]["Row"];
type OrganizationSettingsRow = Database["public"]["Tables"]["organization_settings"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type PackageRow = Database["public"]["Tables"]["packages"]["Row"];

const TRIAL_LENGTH_DAYS = 14;
const EXPIRING_THRESHOLD_DAYS = 3;

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

const determineStatus = (
  org: OrganizationRow,
  payments: AdminUserPaymentSummary[]
): {
  status: MembershipStatus;
  trialEndsAt: string;
  trialDaysRemaining: number;
} => {
  const membershipStartedAt = parseISO(org.created_at);
  const trialEnds = addDays(membershipStartedAt, TRIAL_LENGTH_DAYS);
  const now = new Date();
  const daysElapsed = differenceInCalendarDays(now, membershipStartedAt);
  const trialDaysRemaining = Math.max(0, TRIAL_LENGTH_DAYS - daysElapsed);

  const successfulPaymentStatuses = new Set(["paid", "completed", "succeeded"]);
  const hasSuccessfulPayment = payments.some((payment) =>
    payment.status ? successfulPaymentStatuses.has(payment.status.toLowerCase()) : false
  );

  let status: MembershipStatus = "trial";
  if (hasSuccessfulPayment) {
    status = "premium";
  } else if (daysElapsed > TRIAL_LENGTH_DAYS) {
    status = "expired";
  }

  return {
    status,
    trialEndsAt: trialEnds.toISOString(),
    trialDaysRemaining,
  };
};

const computeMetrics = (users: AdminUserAccount[]): AdminUsersSummaryMetrics =>
  users.reduce<AdminUsersSummaryMetrics>(
    (acc, user) => {
      acc.totalUsers += 1;
      if (user.status === "premium") acc.premiumUsers += 1;
      if (user.status === "trial") {
        acc.activeTrials += 1;
        if ((user.trialDaysRemaining ?? Infinity) <= EXPIRING_THRESHOLD_DAYS) {
          acc.expiringTrials += 1;
        }
      }
      if (user.status === "complimentary") acc.complimentaryUsers += 1;
      if (user.status === "suspended") acc.suspendedUsers += 1;
      return acc;
    },
    {
      totalUsers: 0,
      premiumUsers: 0,
      activeTrials: 0,
      expiringTrials: 0,
      complimentaryUsers: 0,
      suspendedUsers: 0,
    }
  );

const sumPayments = (
  payments: AdminUserPaymentSummary[],
  predicate: (payment: AdminUserPaymentSummary) => boolean
) =>
  payments.reduce((sum, payment) => (predicate(payment) ? sum + (payment.amount ?? 0) : sum), 0);

const mapProjects = (
  projects: ProjectRow[] = [],
  leadNameMap: Map<string, string>,
  statusMap: Map<string, ProjectStatusRow>
): AdminUserProjectSummary[] =>
  projects.map((project) => ({
    ...project,
    status_label: project.status_id ? statusMap.get(project.status_id)?.name ?? null : null,
    lead_name: project.lead_id ? leadNameMap.get(project.lead_id) ?? null : null,
  }));

const mapSessions = (
  sessions: SessionRow[] = [],
  sessionTypeMap: Map<string, SessionTypeRow>
): AdminUserSessionSummary[] =>
  sessions.map((session) => ({
    ...session,
    session_type_label: session.session_type_id
      ? sessionTypeMap.get(session.session_type_id)?.name ?? null
      : null,
  }));

const fetchAdminAccounts = async (): Promise<AdminUserAccount[]> => {
  const [
    organizationsResult,
    profilesResult,
    leadsResult,
    projectsResult,
    sessionsResult,
    activitiesResult,
    paymentsResult,
    projectStatusesResult,
    sessionTypesResult,
    organizationSettingsResult,
    servicesResult,
    packagesResult,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, owner_id, created_at, updated_at")
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email"),
    supabase
      .from("leads")
      .select("id, name, status, email, phone, due_date, updated_at, created_at, organization_id, user_id"),
    supabase
      .from("projects")
      .select(
        "id, name, status_id, lead_id, base_price, organization_id, updated_at, created_at, user_id"
      ),
    supabase
      .from("sessions")
      .select(
        "id, session_name, status, session_date, session_time, session_type_id, organization_id, project_id, lead_id, updated_at, created_at, user_id"
      ),
    supabase
      .from("activities")
      .select(
        "id, content, type, reminder_date, reminder_time, completed, organization_id, lead_id, project_id, updated_at, created_at, user_id"
      ),
    supabase
      .from("payments")
      .select(
        "id, amount, status, type, description, date_paid, created_at, updated_at, organization_id, project_id, user_id"
      ),
    supabase.from("project_statuses").select("id, name, lifecycle"),
    supabase.from("session_types").select("id, name"),
    supabase
      .from("organization_settings")
      .select(
        "organization_id, email, phone, photography_business_name, social_channels, timezone"
      ),
    supabase
      .from("services")
      .select(
        "id, name, category, service_type, price, updated_at, organization_id, is_active"
      ),
    supabase
      .from("packages")
      .select(
        "id, name, price, client_total, is_active, updated_at, organization_id"
      ),
  ]);

  const firstError = getFirstError(
    organizationsResult,
    profilesResult,
    leadsResult,
    projectsResult,
    sessionsResult,
    activitiesResult,
    paymentsResult,
    projectStatusesResult,
    sessionTypesResult,
    organizationSettingsResult,
    servicesResult,
    packagesResult
  );
  if (firstError) {
    throw firstError;
  }

  const organizations = organizationsResult.data ?? [];
  const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const leadNameMap = new Map((leadsResult.data ?? []).map((lead) => [lead.id, lead.name]));
  const projectStatusMap = new Map(
    (projectStatusesResult.data ?? []).map((status) => [status.id, status])
  );
  const sessionTypeList = sessionTypesResult.data ?? [];
  const sessionTypeMap = new Map(sessionTypeList.map((type) => [type.id, type]));
  const sessionTypesByOrg = groupByOrganization(sessionTypeList);
  const organizationSettingsMap = new Map(
    (organizationSettingsResult.data ?? []).map((settings) => [settings.organization_id, settings])
  );

  const leadsByOrg = groupByOrganization(leadsResult.data);
  const projectsByOrg = groupByOrganization(projectsResult.data);
  const sessionsByOrg = groupByOrganization(sessionsResult.data);
  const activitiesByOrg = groupByOrganization(activitiesResult.data);
  const paymentsByOrg = groupByOrganization(paymentsResult.data);
  const servicesByOrg = groupByOrganization<ServiceRow>(
    servicesResult.data as ServiceRow[] | null | undefined
  );
  const packagesByOrg = groupByOrganization<PackageRow>(
    packagesResult.data as PackageRow[] | null | undefined
  );

  return organizations.map<AdminUserAccount>((organization) => {
    const owner = profileMap.get(organization.owner_id) as ProfileRow | undefined;
    const settings = organizationSettingsMap.get(organization.id) as OrganizationSettingsRow | undefined;
    const leads = leadsByOrg[organization.id] ?? [];
    const projects = projectsByOrg[organization.id] ?? [];
    const sessions = sessionsByOrg[organization.id] ?? [];
    const activities = activitiesByOrg[organization.id] ?? [];
    const payments = paymentsByOrg[organization.id] ?? [];
    const services = servicesByOrg[organization.id] ?? [];
    const packages = packagesByOrg[organization.id] ?? [];
    const sessionTypes = sessionTypesByOrg[organization.id] ?? [];

    const mappedProjects = mapProjects(projects, leadNameMap, projectStatusMap);
    const mappedSessions = mapSessions(sessions, sessionTypeMap);

    const upcomingSessions = mappedSessions.filter((session) => {
      if (!session.session_date) return false;
      try {
        return isAfter(new Date(`${session.session_date}T${session.session_time ?? "00:00"}`), new Date());
      } catch {
        return false;
      }
    });

    const lastActiveAt = computeLastActiveAt(organization, leads, projects, sessions, activities, payments);
    const { status, trialEndsAt, trialDaysRemaining } = determineStatus(organization, payments);

    const successfulPayments = payments.filter((payment) =>
      payment.status ? ["paid", "completed", "succeeded"].includes(payment.status.toLowerCase()) : false
    );
    const lifetimeValue = sumPayments(successfulPayments, () => true);
    const paymentsLast30d = sumPayments(successfulPayments, (payment) => {
      if (!payment.date_paid) return false;
      const paidDate = new Date(payment.date_paid);
      const threshold = addDays(new Date(), -30);
      return paidDate >= threshold;
    });
    const overdueBalance = sumPayments(
      payments,
      (payment) => payment.status ? ["pending", "scheduled"].includes(payment.status.toLowerCase()) : false
    );

    const businessSocialChannels = (() => {
      const raw = settings?.social_channels;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
      return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (value == null) return acc;
          acc[key] = String(value);
          return acc;
        },
        {}
      );
    })();

    return {
      id: organization.id,
      name: organization.name,
      email: owner?.email ?? "",
      company: organization.name,
      status,
      planName: status === "premium" ? "Premium" : "Trial",
      membershipStartedAt: organization.created_at,
      trialEndsAt,
      trialDaysRemaining,
      lastActiveAt,
      accountOwner: owner?.full_name ?? owner?.email ?? undefined,
      timezone: settings?.timezone ?? undefined,
      business: {
        businessName: settings?.photography_business_name ?? organization.name,
        businessEmail: settings?.email ?? owner?.email ?? null,
        phone: settings?.phone ?? null,
        socialChannels: businessSocialChannels,
      },
      stats: {
        projects: projects.length,
        activeProjects: mappedProjects.length, // All visible for now
        leads: leads.length,
        sessions: sessions.length,
        upcomingSessions: upcomingSessions.length,
        calendarEvents: activities.length,
        payments: payments.length,
        teamMembers: 1,
      },
      financials: {
        monthlyRecurringRevenue: paymentsLast30d,
        lifetimeValue,
        averageDealSize: successfulPayments.length
          ? Math.round(lifetimeValue / successfulPayments.length)
          : 0,
        overdueBalance,
      },
      detail: {
        leads,
        projects: mappedProjects,
        sessions: mappedSessions,
        calendar: activities as AdminUserCalendarEventSummary[],
        payments: payments as AdminUserPaymentSummary[],
        services: services as AdminUserServiceSummary[],
        packages: packages as AdminUserPackageSummary[],
        sessionTypes: sessionTypes as AdminUserSessionTypeSummary[],
      },
    };
  });
};

export function useAdminUsersData() {
  const query = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminAccounts,
    staleTime: 60 * 1000,
  });

  const users = query.data ?? [];
  const metrics = useMemo(() => computeMetrics(users), [users]);

  const availableStatuses = useMemo<MembershipStatus[]>(() => {
    const unique = new Set<MembershipStatus>();
    users.forEach((user) => unique.add(user.status));
    return Array.from(unique);
  }, [users]);

  return {
    users,
    metrics,
    expiringThresholdDays: EXPIRING_THRESHOLD_DAYS,
    availableStatuses,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
