import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { ADD_ACTION_EVENTS } from "@/constants/addActionEvents";
import GlobalSearch from "@/components/GlobalSearch";
import { getWeekRange, isNetworkError } from "@/lib/utils";
import { useDashboardTranslation } from "@/hooks/useTypedTranslation";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import type { Database } from "@/integrations/supabase/types";
import DashboardDailyFocus, { type SessionWithLead } from "@/components/DashboardDailyFocus";
import NewSessionDialog from "@/components/NewSessionDialog";
import { ProjectCreationWizardSheet } from "@/features/project-creation";
import { countInactiveLeads } from "@/lib/leadLifecycle";
import { computePaymentSummaryMetrics } from "@/lib/payments/metrics";
import { useProfile } from "@/hooks/useProfile";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useConnectivity } from "@/contexts/useConnectivity";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadWithStatusRow = LeadRow & {
  lead_statuses?: {
    is_system_final: boolean | null;
    name: string | null;
    lifecycle?: string | null;
  } | null;
};
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionSummaryRow = Pick<SessionRow, "id" | "session_date" | "status" | "created_at">;
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type PaymentSummaryRow = Pick<
  PaymentRow,
  | "id"
  | "amount"
  | "status"
  | "entry_kind"
  | "log_timestamp"
  | "date_paid"
  | "created_at"
  | "scheduled_initial_amount"
  | "scheduled_remaining_amount"
  | "project_id"
>;
type PaymentMetricsRow = Pick<
  PaymentRow,
  | "id"
  | "amount"
  | "status"
  | "entry_kind"
  | "scheduled_initial_amount"
  | "scheduled_remaining_amount"
  | "project_id"
>;

type PaymentTimestampColumn = "created_at" | "date_paid" | "log_timestamp";
type OptionalPaymentColumn =
  | "date_paid"
  | "log_timestamp"
  | "scheduled_initial_amount"
  | "scheduled_remaining_amount"
  | "entry_kind";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

const paymentSchemaEnhancementsEnabled =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_ENABLE_PAYMENT_SCHEMA_ENHANCEMENTS === "true") ||
  false;

const CrmDashboard = () => {
  const [leads, setLeads] = useState<LeadWithStatusRow[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithLead[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [sessionWindowRange, setSessionWindowRange] = useState<{ startIso: string; endIso: string } | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionSummaryRow[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentSummaryRow[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<PaymentSummaryRow[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const paymentColumnSupportRef = useRef<Record<PaymentTimestampColumn | OptionalPaymentColumn, boolean>>({
    created_at: true,
    date_paid: paymentSchemaEnhancementsEnabled,
    log_timestamp: paymentSchemaEnhancementsEnabled,
    scheduled_initial_amount: true,
    scheduled_remaining_amount: true,
    entry_kind: true,
  });
  const { profile } = useProfile();
  const { activeOrganization } = useOrganization();
  const { reportNetworkError, reportRecovery } = useConnectivity();
  const navigate = useNavigate();
  const { t } = useDashboardTranslation();
  const organizationId = activeOrganization?.id;

  useEffect(() => {
    const handleAddLead = (event: Event) => {
      event.preventDefault();
      setAddLeadDialogOpen(true);
    };
    window.addEventListener(ADD_ACTION_EVENTS.lead, handleAddLead);
    return () => {
      window.removeEventListener(ADD_ACTION_EVENTS.lead, handleAddLead);
    };
  }, []);

  useEffect(() => {
    const handleAddProject = (event: Event) => {
      event.preventDefault();
      setProjectWizardOpen(true);
    };

    window.addEventListener(ADD_ACTION_EVENTS.project, handleAddProject);
    return () => {
      window.removeEventListener(ADD_ACTION_EVENTS.project, handleAddProject);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      const metadata =
        (data.user?.user_metadata as {
          full_name?: string;
          name?: string;
          first_name?: string;
          last_name?: string;
          username?: string;
          preferred_name?: string;
        }) || {};
      const constructedName = [metadata.first_name, metadata.last_name].filter(Boolean).join(" ").trim();
      const derivedName =
        metadata.full_name ||
        metadata.preferred_name ||
        metadata.name ||
        constructedName ||
        metadata.username ||
        null;
      setUserName(derivedName || null);
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fullName = profile?.full_name?.trim();
    if (!fullName) return;
    setUserName(fullName);
  }, [profile?.full_name]);

  useEffect(() => {
    const ownerId = activeOrganization?.owner_id;
    if (!ownerId) return;
    if (profile?.user_id === ownerId && profile?.full_name) {
      // Already handled by the profile effect above
      return;
    }

    let isMounted = true;
    const fetchOwnerName = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", ownerId)
        .maybeSingle();
      if (error) {
        console.error("Failed to fetch account owner name", error);
        return;
      }
      if (!isMounted) return;
      const ownerName = data?.full_name?.trim();
      if (ownerName) {
        setUserName(ownerName);
      }
    };

    void fetchOwnerName();
    return () => {
      isMounted = false;
    };
  }, [activeOrganization?.owner_id, profile?.full_name, profile?.user_id]);

  const fetchData = useCallback(async (anchorDate?: Date) => {
    if (!organizationId) {
      return;
    }

    try {
      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from<LeadRow>('leads')
        .select('*, lead_statuses ( is_system_final, name, lifecycle )')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch activities with reminders
      const { data: activitiesData, error: activitiesError } = await supabase
        .from<ActivityRow>('activities')
        .select('*')
        .eq('organization_id', organizationId)
        .not('reminder_date', 'is', null)
        .order('reminder_date', { ascending: true });

      if (activitiesError) throw activitiesError;

      // Fetch sessions within a broader rolling window so dashboard week nav can move without empty data
      const referenceDate = anchorDate ?? new Date();
      const pastBufferDate = new Date(referenceDate);
      pastBufferDate.setDate(pastBufferDate.getDate() - 84); // ~12 weeks back
      const futureBufferDate = new Date(referenceDate);
      futureBufferDate.setDate(futureBufferDate.getDate() + 84); // ~12 weeks forward

      const { start: startOfWindow } = getWeekRange(pastBufferDate);
      const { end: endOfWindow } = getWeekRange(futureBufferDate);
      const startIso = startOfWindow.toISOString().split('T')[0];
      const endIso = endOfWindow.toISOString().split('T')[0];

      const { data: sessionsData, error: sessionsError } = await supabase
        .from<SessionRow>('sessions')
        .select('*, session_types(duration_minutes)')
        .eq('organization_id', organizationId)
        .gte('session_date', startIso)
        .lte('session_date', endIso)
        .order('session_date', { ascending: true })
        .order('session_time', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Get lead names for all sessions (no status filtering - show all sessions this week)
      if (sessionsData && sessionsData.length > 0) {
        const leadIds = sessionsData.map(session => session.lead_id);
        type LeadSummary = Pick<LeadRow, 'id' | 'name' | 'status'>;
        const { data: leadNamesData } = await supabase
          .from<LeadSummary>('leads')
          .select('id, name, status')
          .eq('organization_id', organizationId)
          .in('id', leadIds);

        const sessionSummaries: SessionWithLead[] = sessionsData.map(session => {
          const sessionTypes = session.session_types as { duration_minutes?: number | null } | null;
          return {
            ...session,
            lead_name: leadNamesData?.find(lead => lead.id === session.lead_id)?.name || 'Unknown Client',
            duration_minutes: sessionTypes?.duration_minutes ?? null
          };
        });

        setUpcomingSessions(sessionSummaries);
      } else {
        setUpcomingSessions([]);
      }

      const now = new Date();
      const statsStartDate = new Date(now.getFullYear() - 1, 0, 1);
      const statsStartDateIso = statsStartDate.toISOString().split('T')[0];
      const statsStartDateTime = statsStartDate.toISOString();

      const { data: sessionStatsData, error: sessionStatsError } = await supabase
        .from<SessionSummaryRow>('sessions')
        .select('id, session_date, status, created_at')
        .eq('organization_id', organizationId)
        .gte('session_date', statsStartDateIso);

      if (sessionStatsError) throw sessionStatsError;

      const basePaymentColumns = ['id', 'amount', 'status', 'created_at', 'project_id'];

      const buildPaymentSelectColumns = () => {
        const columns = [...basePaymentColumns];
        (['entry_kind', 'date_paid', 'log_timestamp', 'scheduled_initial_amount', 'scheduled_remaining_amount'] as OptionalPaymentColumn[])
          .forEach((column) => {
            if (paymentColumnSupportRef.current[column]) {
              columns.push(column);
            }
          });
        return columns;
      };

      const detectMissingPaymentColumn = (error: unknown): (PaymentTimestampColumn | OptionalPaymentColumn) | null => {
        if (!error || typeof error !== 'object') return null;
        const code = (error as { code?: string }).code;
        if (code !== '42703') return null;
        const message = typeof (error as { message?: string }).message === 'string'
          ? (error as { message?: string }).message
          : '';
        if (message?.includes('log_timestamp')) return 'log_timestamp';
        if (message?.includes('date_paid')) return 'date_paid';
        if (message?.includes('created_at')) return 'created_at';
        if (message?.includes('entry_kind')) return 'entry_kind';
        if (message?.includes('scheduled_initial_amount')) return 'scheduled_initial_amount';
        if (message?.includes('scheduled_remaining_amount')) return 'scheduled_remaining_amount';
        return null;
      };

      let archivedStatusIdCache: string | null | undefined;

      const getArchivedStatusId = async (): Promise<string | null> => {
        if (archivedStatusIdCache !== undefined) {
          return archivedStatusIdCache;
        }
        const { data, error } = await supabase
          .from('project_statuses')
          .select('id')
          .eq('organization_id', organizationId)
          .ilike('name', 'archived')
          .maybeSingle();
        if (error) {
          console.warn('Failed to fetch archived status id', error);
          archivedStatusIdCache = null;
          return archivedStatusIdCache;
        }
        archivedStatusIdCache = data?.id ?? null;
        return archivedStatusIdCache;
      };

      const filterOutArchivedPayments = async <T extends { project_id?: string | null }>(
        payments: T[]
      ): Promise<T[]> => {
        if (!payments.length) {
          return payments;
        }
        const archivedStatusId = await getArchivedStatusId();
        if (!archivedStatusId) {
          return payments;
        }
        const projectIds = Array.from(
          new Set(
            payments
              .map((payment) => payment.project_id)
              .filter((id): id is string => Boolean(id))
          )
        );
        if (!projectIds.length) {
          return payments;
        }

        const { data: projects, error: projectsError } = await supabase
          .from<Pick<ProjectRow, 'id' | 'status_id'>>('projects')
          .select('id, status_id')
          .eq('organization_id', organizationId)
          .in('id', projectIds);

        if (projectsError) {
          console.warn('Failed to fetch project statuses while filtering archived payments', projectsError);
          return payments;
        }

        const archivedProjects = new Set(
          (projects ?? [])
            .filter((project) => project.status_id === archivedStatusId)
            .map((project) => project.id)
        );

        if (!archivedProjects.size) {
          return payments;
        }

        return payments.filter((payment) => {
          const projectId = payment.project_id ?? null;
          return !projectId || !archivedProjects.has(projectId);
        });
      };

      const fetchPaymentsSince = async (column: PaymentTimestampColumn): Promise<PaymentSummaryRow[]> => {
        if (!paymentColumnSupportRef.current[column]) {
          return [];
        }

        const selectColumns = buildPaymentSelectColumns();
        let query = supabase
          .from<PaymentSummaryRow>('payments')
          .select(selectColumns.join(', '))
          .eq('organization_id', organizationId);

        if (paymentColumnSupportRef.current.entry_kind) {
          query = query.eq('entry_kind', 'recorded');
        }

        if (column !== 'created_at') {
          query = query.not(column, 'is', null);
        }

        const { data, error } = await query.gte(column, statsStartDateTime);

        if (error) {
          const missingColumn = detectMissingPaymentColumn(error);
          if (missingColumn) {
            paymentColumnSupportRef.current[missingColumn] = false;
            console.warn(
              `[dashboard] Column ${missingColumn} missing in payments table. Falling back without it.`
            );
            if (missingColumn === 'entry_kind') {
              // Rebuild query without entry_kind filter by recursing
              return fetchPaymentsSince(column);
            }
            if (missingColumn === column) {
              return fetchPaymentsSince(column);
            }
            // For select-only optional columns, simply retry the same column now that it is disabled
            if (
              missingColumn === 'scheduled_initial_amount' ||
              missingColumn === 'scheduled_remaining_amount' ||
              missingColumn === 'date_paid' ||
              missingColumn === 'log_timestamp'
            ) {
              return fetchPaymentsSince(column);
            }
          }
          throw error;
        }

        return data ?? [];
      };

      const createdPayments = await fetchPaymentsSince('created_at');
      const paidPayments = await fetchPaymentsSince('date_paid');
      const loggedPayments = await fetchPaymentsSince('log_timestamp');

      const paymentStatsDataRaw = Array.from(
        new Map(
          [...createdPayments, ...paidPayments, ...loggedPayments].map((payment) => [payment.id, payment])
        ).values()
      );
      const paymentStatsData = await filterOutArchivedPayments(paymentStatsDataRaw);

      const fetchScheduledPayments = async (): Promise<PaymentSummaryRow[]> => {
        if (!paymentColumnSupportRef.current.entry_kind) {
          return [];
        }

        const selectColumns = buildPaymentSelectColumns();
        let scheduledQuery = supabase
          .from<PaymentSummaryRow>('payments')
          .select(selectColumns.join(', '))
          .eq('organization_id', organizationId)
          .eq('entry_kind', 'scheduled');

        if (paymentColumnSupportRef.current.scheduled_remaining_amount) {
          scheduledQuery = scheduledQuery.gt('scheduled_remaining_amount', 0);
        }

        const { data, error } = await scheduledQuery;

        if (error) {
          const missingColumn = detectMissingPaymentColumn(error);
          if (missingColumn) {
            paymentColumnSupportRef.current[missingColumn] = false;
            console.warn(
              `[dashboard] Column ${missingColumn} missing in payments table while fetching scheduled payments.`
            );
            if (missingColumn === 'entry_kind') {
              return [];
            }
            return fetchScheduledPayments();
          }
          throw error;
        }

        const positivePayments =
          data?.filter((payment) => {
            const remaining =
              Number(payment.scheduled_remaining_amount ?? payment.amount ?? 0) || 0;
            return remaining > 0;
          }) ?? [];

        return filterOutArchivedPayments(positivePayments);
      };

      const scheduledPaymentsData = await fetchScheduledPayments();

      const fetchOutstandingBalance = async (): Promise<number> => {
        const selectColumns = ['id', 'amount', 'status', 'entry_kind', 'project_id'];
        if (paymentColumnSupportRef.current.scheduled_initial_amount) {
          selectColumns.push('scheduled_initial_amount');
        }
        if (paymentColumnSupportRef.current.scheduled_remaining_amount) {
          selectColumns.push('scheduled_remaining_amount');
        }
        const { data, error } = await supabase
          .from<PaymentMetricsRow>('payments')
          .select(selectColumns.join(', '))
          .eq('organization_id', organizationId);

        if (error) {
          const missingColumn = detectMissingPaymentColumn(error);
          if (missingColumn) {
            paymentColumnSupportRef.current[missingColumn] = false;
            console.warn(
              `[dashboard] Column ${missingColumn} missing in payments table while fetching outstanding balance.`
            );
            return fetchOutstandingBalance();
          }
          throw error;
        }

        const filteredPayments = await filterOutArchivedPayments(data ?? []);
        const metrics = computePaymentSummaryMetrics(filteredPayments);
        return metrics.remainingBalance;
      };

      const outstandingBalanceValue = await fetchOutstandingBalance();

      setLeads((leadsData as LeadWithStatusRow[]) ?? []);
      setActivities(activitiesData ?? []);
      setSessionStats(sessionStatsData ?? []);
      setPaymentStats(paymentStatsData ?? []);
        setScheduledPayments(scheduledPaymentsData ?? []);
        setOutstandingBalance(outstandingBalanceValue);
        setSessionWindowRange({ startIso, endIso });
      reportRecovery();
    } catch (error) {
      if (isNetworkError(error)) {
        reportNetworkError(error, 'service');
      } else {
        toast({
          title: "Error",
          description: getErrorMessage(error),
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Throttle refresh on window focus / visibility changes
  useThrottledRefetchOnFocus(fetchData, 30_000);

  const inactiveLeadCount = useMemo(() => countInactiveLeads(leads, 14), [leads]);



  const handleSignOut = async () => {
    const { signOutSafely } = await import('@/utils/authUtils');
    await signOutSafely();
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-800 overflow-x-hidden">
      <PageHeader title={t('page.title')}>
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
        </PageHeaderSearch>
      </PageHeader>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <DashboardDailyFocus
          leads={leads}
          sessions={upcomingSessions}
          activities={activities}
          loading={loading}
          sessionWindowRange={sessionWindowRange || undefined}
          onWeekReferenceOutOfRange={(anchor) => fetchData(anchor)}
          userName={userName}
          inactiveLeadCount={inactiveLeadCount}
          sessionStats={sessionStats}
          paymentStats={paymentStats}
          scheduledPayments={scheduledPayments}
          outstandingBalance={outstandingBalance}
        />
      </main>

      <EnhancedAddLeadDialog
        onSuccess={() => fetchData()}
        open={addLeadDialogOpen}
        onOpenChange={setAddLeadDialogOpen}
        onClose={() => setAddLeadDialogOpen(false)}
      />
      <ProjectCreationWizardSheet
        isOpen={projectWizardOpen}
        onOpenChange={setProjectWizardOpen}
        entrySource="dashboard_daily_focus"
        onProjectCreated={() => {
          setProjectWizardOpen(false);
          fetchData();
        }}
      />
      <NewSessionDialog
        onSessionScheduled={() => fetchData()}
        openEvent={ADD_ACTION_EVENTS.session}
        showDefaultTrigger={false}
      />
    </div>
  );
};

export default CrmDashboard;
