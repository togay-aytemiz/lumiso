import type { Database } from "@/integrations/supabase/types";

export type MembershipStatus = "trial" | "premium" | "expired" | "suspended" | "complimentary";

export type AdminUserLeadSummary = Database["public"]["Tables"]["leads"]["Row"];
export type AdminUserProjectSummary = Database["public"]["Tables"]["projects"]["Row"] & {
  status_label?: string | null;
  lead_name?: string | null;
};
export type AdminUserSessionSummary = Database["public"]["Tables"]["sessions"]["Row"] & {
  session_type_label?: string | null;
};
export type AdminUserCalendarEventSummary = Database["public"]["Tables"]["activities"]["Row"];
export type AdminUserPaymentSummary = Database["public"]["Tables"]["payments"]["Row"];
export type AdminUserServiceSummary = Database["public"]["Tables"]["services"]["Row"];
export type AdminUserPackageSummary = Database["public"]["Tables"]["packages"]["Row"];
export type AdminUserSessionTypeSummary = Database["public"]["Tables"]["session_types"]["Row"];

export interface AdminUserBusinessProfile {
  businessName?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  socialChannels?: Record<string, string>;
}

export interface AdminUserUsageSnapshot {
  projects: number;
  activeProjects: number;
  leads: number;
  sessions: number;
  upcomingSessions: number;
  calendarEvents: number;
  payments: number;
  teamMembers: number;
}

export interface AdminUserFinancials {
  monthlyRecurringRevenue: number;
  lifetimeValue: number;
  averageDealSize: number;
  overdueBalance: number;
}

export interface AdminUserDetailCollections {
  leads: AdminUserLeadSummary[];
  projects: AdminUserProjectSummary[];
  sessions: AdminUserSessionSummary[];
  calendar: AdminUserCalendarEventSummary[];
  payments: AdminUserPaymentSummary[];
  services: AdminUserServiceSummary[];
  packages: AdminUserPackageSummary[];
  sessionTypes: AdminUserSessionTypeSummary[];
}

export interface AdminUserAccount {
  id: string;
  name: string;
  company?: string;
  email: string;
  avatarUrl?: string;
  status: MembershipStatus;
  planName: string;
  membershipStartedAt: string;
  premiumActivatedAt?: string;
  trialEndsAt?: string;
  trialDaysRemaining?: number;
  lastActiveAt: string;
  accountOwner?: string;
  timezone?: string;
  notes?: string;
  tags?: string[];
  business: AdminUserBusinessProfile;
  stats: AdminUserUsageSnapshot;
  financials: AdminUserFinancials;
  detail: AdminUserDetailCollections;
}

export interface AdminUsersSummaryMetrics {
  totalUsers: number;
  premiumUsers: number;
  activeTrials: number;
  expiringTrials: number;
  complimentaryUsers: number;
  suspendedUsers: number;
}
