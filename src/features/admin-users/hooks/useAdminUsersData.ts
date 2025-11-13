import { useQuery } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, isAfter, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import type {
  AdminUserAccount,
  AdminUserLeadSummary,
  AdminUserPackageSummary,
  AdminUserPaymentSummary,
  AdminUserProjectSummary,
  AdminUserServiceSummary,
  AdminUserSessionSummary,
  AdminUserSessionTypeSummary,
  MembershipStatus,
} from "../types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type OrganizationSettingsRow = Database["public"]["Tables"]["organization_settings"]["Row"];

const TRIAL_LENGTH_DAYS = 14;

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

const sumPayments = (
  payments: AdminUserPaymentSummary[],
  predicate: (payment: AdminUserPaymentSummary) => boolean
) =>
  payments.reduce((sum, payment) => (predicate(payment) ? sum + (payment.amount ?? 0) : sum), 0);

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
    .select("id, name, owner_id, created_at, updated_at")
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
  ] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name"),
    supabase
      .from("payments")
      .select(
        "id, amount, status, type, description, date_paid, created_at, updated_at, organization_id, project_id, user_id"
      )
      .in("organization_id", organizationIds),
    supabase
      .from("organization_settings")
      .select(
        "organization_id, email, phone, photography_business_name, social_channels, timezone"
      )
      .in("organization_id", organizationIds),
    supabase.from("leads").select("id, organization_id").in("organization_id", organizationIds),
    supabase.from("projects").select("id, organization_id").in("organization_id", organizationIds),
    supabase.from("sessions").select("id, organization_id").in("organization_id", organizationIds),
  ]);

  const firstError = getFirstError(
    profilesResult,
    paymentsResult,
    organizationSettingsResult,
    leadsResult,
    projectsResult,
    sessionsResult
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
  const projectsByOrg = groupByOrganization(projectsResult.data);
  const sessionsByOrg = groupByOrganization(sessionsResult.data);

  return organizations.map<AdminUserAccount>((organization) => {
    const owner = profileMap.get(organization.owner_id) as ProfileRow | undefined;
    const settings = organizationSettingsMap.get(organization.id) as OrganizationSettingsRow | undefined;
    const organizationEmail = settings?.email ?? null;
    const payments = paymentsByOrg[organization.id] ?? [];
    const leads = leadsByOrg[organization.id] ?? [];
    const projects = projectsByOrg[organization.id] ?? [];
    const sessions = sessionsByOrg[organization.id] ?? [];
    const lastActiveAt = computeLastActiveAt(organization, [], [], [], [], payments);
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
      email: organizationEmail ?? "",
      company: organization.name,
      status,
      planName: status === "premium" ? "Premium" : "Trial",
      membershipStartedAt: organization.created_at,
      trialEndsAt,
      trialDaysRemaining,
      lastActiveAt,
      accountOwner: owner?.full_name ?? undefined,
      timezone: settings?.timezone ?? undefined,
      business: {
        businessName: settings?.photography_business_name ?? organization.name,
        businessEmail: organizationEmail,
        businessPhone: settings?.phone ?? null,
        socialChannels: businessSocialChannels,
      },
      stats: {
        projects: projects.length,
        activeProjects: projects.length,
        leads: leads.length,
        sessions: sessions.length,
        upcomingSessions: 0,
        calendarEvents: 0,
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
        leads: [] as AdminUserLeadSummary[],
        projects: [] as AdminUserProjectSummary[],
        sessions: [] as AdminUserSessionSummary[],
        calendar: [],
        payments: payments as AdminUserPaymentSummary[],
        services: [] as AdminUserServiceSummary[],
        packages: [] as AdminUserPackageSummary[],
        sessionTypes: [] as AdminUserSessionTypeSummary[],
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
