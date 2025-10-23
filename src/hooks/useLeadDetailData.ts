import { useCallback, useMemo } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  fetchLeadById,
  fetchLeadSessions,
  fetchLeadProjectSummary,
  fetchLatestLeadActivity,
  LeadDetailRecord,
  LeadSessionRecord,
  LeadProjectSummaryPayload,
  AggregatedPaymentSummary,
  ProjectSummary
} from "@/services/LeadDetailService";
import { useLeadStatuses } from "./useOrganizationData";

const ACTIVE_SESSION_STATUSES = new Set(["planned", "upcoming", "confirmed", "scheduled"]);

interface SessionMetrics {
  todayCount: number;
  todayNext: LeadSessionRecord | null;
  nextUpcoming: LeadSessionRecord | null;
  overdueCount: number;
}

export interface LeadDetailQueryResult {
  lead: LeadDetailRecord | null;
  leadQuery: UseQueryResult<LeadDetailRecord | null, unknown>;
  sessions: LeadSessionRecord[];
  sessionsQuery: UseQueryResult<LeadSessionRecord[], unknown>;
  projectSummary: ProjectSummary;
  aggregatedPayments: AggregatedPaymentSummary;
  summaryQuery: UseQueryResult<LeadProjectSummaryPayload, unknown>;
  latestLeadActivity: string | null;
  latestActivityQuery: UseQueryResult<string | null, unknown>;
  leadStatuses: any[];
  sessionMetrics: SessionMetrics;
  latestSessionUpdate: string | null;
  hasProjects: boolean;
  isLoading: boolean;
  refetchAll: () => Promise<void>;
}

const DEFAULT_SUMMARY: ProjectSummary = { count: 0, latestUpdate: null };
const DEFAULT_PAYMENTS: AggregatedPaymentSummary = {
  totalPaid: 0,
  total: 0,
  remaining: 0,
  currency: "TRY"
};
const DEFAULT_METRICS: SessionMetrics = {
  todayCount: 0,
  todayNext: null,
  nextUpcoming: null,
  overdueCount: 0
};

function sortSessions(sessions: LeadSessionRecord[]): LeadSessionRecord[] {
  const sorted = [...sessions];

  sorted.sort((a, b) => {
    const aStatus = (a.status || "").toLowerCase();
    const bStatus = (b.status || "").toLowerCase();

    const aIsPlanned = aStatus === "planned";
    const bIsPlanned = bStatus === "planned";

    if (aIsPlanned !== bIsPlanned) {
      return aIsPlanned ? -1 : 1;
    }

    const aDate = a.session_date ? new Date(a.session_date).getTime() : 0;
    const bDate = b.session_date ? new Date(b.session_date).getTime() : 0;

    return bDate - aDate;
  });

  return sorted;
}

function computeSessionMetrics(sessions: LeadSessionRecord[]): SessionMetrics {
  if (!sessions.length) {
    return DEFAULT_METRICS;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const activeSessions = sessions
    .map((session) => {
      if (!session.session_date) return null;
      const normalizedStatus = (session.status || "").toLowerCase();
      if (!ACTIVE_SESSION_STATUSES.has(normalizedStatus)) return null;

      const date = (() => {
        const timePart = (session.session_time ?? "").trim();
        if (timePart) {
          const candidate = new Date(`${session.session_date}T${timePart}`);
          if (!Number.isNaN(candidate.getTime())) return candidate;
        }

        const fallback = new Date(session.session_date);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
      })();

      if (!date) return null;
      return { session, date };
    })
    .filter((value): value is { session: LeadSessionRecord; date: Date } => Boolean(value))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const todays: LeadSessionRecord[] = [];
  let nextUpcoming: LeadSessionRecord | null = null;
  let overdueCount = 0;

  for (const entry of activeSessions) {
    const sessionKey = entry.session.session_date
      ? entry.session.session_date.slice(0, 10)
      : null;

    if (!sessionKey) continue;

    if (sessionKey < todayKey) {
      overdueCount += 1;
      continue;
    }

    if (sessionKey === todayKey) {
      todays.push(entry.session);
      continue;
    }

    if (!nextUpcoming) {
      nextUpcoming = entry.session;
    }
  }

  return {
    todayCount: todays.length,
    todayNext: todays[0] ?? null,
    nextUpcoming,
    overdueCount
  };
}

function computeLatestSessionUpdate(sessions: LeadSessionRecord[]): string | null {
  if (!sessions.length) return null;

  return sessions.reduce<string | null>((latest, session) => {
    const candidate = session.updated_at || session.created_at || null;
    if (!candidate) return latest;
    if (!latest) return candidate;
    return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
  }, null);
}

export function useLeadDetailData(leadId?: string): LeadDetailQueryResult {
  const { activeOrganizationId, loading: orgLoading } = useOrganization();
  const {
    data: leadStatuses = [],
    isLoading: statusesLoading
  } = useLeadStatuses();

  const leadQuery = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => fetchLeadById(leadId!),
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000
  });

  const sessionsQuery = useQuery({
    queryKey: ["lead", leadId, "sessions", activeOrganizationId],
    queryFn: () => fetchLeadSessions(leadId!, activeOrganizationId),
    enabled: !!leadId && !orgLoading,
    staleTime: 2 * 60 * 1000
  });

  const summaryQuery = useQuery({
    queryKey: ["lead", leadId, "project-summary", activeOrganizationId],
    queryFn: () => fetchLeadProjectSummary(leadId!, activeOrganizationId!),
    enabled: !!leadId && !!activeOrganizationId,
    staleTime: 2 * 60 * 1000
  });

  const latestActivityQuery = useQuery({
    queryKey: ["lead", leadId, "latest-activity"],
    queryFn: () => fetchLatestLeadActivity(leadId!),
    enabled: !!leadId,
    staleTime: 60 * 1000
  });

  const sessions = useMemo(() => {
    if (!sessionsQuery.data) return [];
    return sortSessions(sessionsQuery.data).map((session) => ({
      ...session,
      project_name: session.projects?.name ?? undefined
    }));
  }, [sessionsQuery.data]);

  const sessionMetrics = useMemo(() => computeSessionMetrics(sessions), [sessions]);
  const latestSessionUpdate = useMemo(() => computeLatestSessionUpdate(sessions), [sessions]);

  const projectSummary = summaryQuery.data?.summary ?? DEFAULT_SUMMARY;
  const aggregatedPayments = summaryQuery.data?.payments ?? DEFAULT_PAYMENTS;

  const isLoading =
    leadQuery.isLoading ||
    sessionsQuery.isLoading ||
    summaryQuery.isLoading ||
    latestActivityQuery.isLoading ||
    statusesLoading ||
    orgLoading;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      leadQuery.refetch(),
      sessionsQuery.refetch(),
      summaryQuery.refetch(),
      latestActivityQuery.refetch()
    ]);
  }, [leadQuery, sessionsQuery, summaryQuery, latestActivityQuery]);

  return {
    lead: leadQuery.data ?? null,
    leadQuery,
    sessions,
    sessionsQuery,
    projectSummary,
    aggregatedPayments,
    summaryQuery,
    latestLeadActivity: latestActivityQuery.data ?? null,
    latestActivityQuery,
    leadStatuses,
    sessionMetrics,
    latestSessionUpdate,
    hasProjects: summaryQuery.data?.hasProjects ?? false,
    isLoading,
    refetchAll
  };
}
