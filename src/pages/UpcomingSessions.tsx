import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, AlertTriangle, CalendarCheck2, CalendarClock, FileDown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import NewSessionDialog from "@/components/NewSessionDialog";
import { formatTime, formatLongDate } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
// Render project stage inline; no need to import ProjectStatusBadge here
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import SessionSheetView from "@/components/SessionSheetView";
import {
  AdvancedDataTable,
  type AdvancedTableColumn,
  type AdvancedDataTableSortState,
} from "@/components/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { getKpiIconPreset, KPI_ACTION_BUTTON_CLASS } from "@/components/ui/kpi-presets";
import { writeFileXLSX, utils as XLSXUtils } from "xlsx/xlsx.mjs";
import { format } from "date-fns";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSessionStatuses } from "@/hooks/useOrganizationData";

interface Session {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  created_at: string;
  project_id?: string | null;
  project_name?: string;
  project_status_id?: string | null;
  project_status?: { id: string; name: string; color: string } | null;
  lead_name?: string;
  lead_status?: string;
}

type SessionLifecycle = 'active' | 'completed' | 'cancelled' | 'planned' | 'unknown';

type SessionSegment = 'all' | 'upcoming' | 'in_progress' | 'pending' | 'past' | 'cancelled';

interface SessionStatusRecord {
  id: string;
  name: string;
  color: string;
  lifecycle: string | null;
  is_system_initial: boolean;
}

interface SessionWithComputed extends Session {
  statusId: string | null;
  statusDisplayName: string;
  statusColor: string;
  statusLifecycle: SessionLifecycle;
  statusIsInitial: boolean;
  segment: Exclude<SessionSegment, 'all'>;
}

const normalizeStatusName = (value?: string | null) =>
  (value ?? '').trim().toLowerCase();

const normalizeLifecycle = (value?: string | null): SessionLifecycle => {
  const normalized = normalizeStatusName(value);
  if (normalized === "active" || normalized === "completed" || normalized === "cancelled" || normalized === "planned") {
    return normalized as SessionLifecycle;
  }
  return "unknown";
};

const getFallbackLifecycle = (status: string): SessionLifecycle => {
  const normalized = normalizeStatusName(status);

  if (["completed", "delivered", "in_post_processing"].includes(normalized)) {
    return "completed";
  }

  if (["cancelled", "no_show", "archived"].includes(normalized)) {
    return "cancelled";
  }

  if (normalized === "planned" || normalized === "scheduled") {
    return "planned";
  }

  return "active";
};

const getFallbackColor = (lifecycle: SessionLifecycle, isInitial: boolean) => {
  if (lifecycle === "completed") return "#22c55e"; // green
  if (lifecycle === "cancelled") return "#ef4444"; // red
  if (lifecycle === "planned" || isInitial) return "#A0AEC0"; // muted gray
  return "#2563eb"; // blue for active/in-progress
};

const determineSegment = (
  lifecycle: SessionLifecycle,
  isInitial: boolean,
  sessionDate: Date | null,
  startOfToday: Date,
  endOfToday: Date,
): Exclude<SessionSegment, 'all'> => {
  if (lifecycle === "cancelled") return "cancelled";
  if (lifecycle === "completed") return "past";

  const effectiveLifecycle = lifecycle === "planned" ? "planned" : lifecycle;
  const hasDate = sessionDate && !Number.isNaN(sessionDate.getTime());

  if (!hasDate) {
    return isInitial ? "upcoming" : "in_progress";
  }

  if (effectiveLifecycle === "planned" || (effectiveLifecycle === "active" && isInitial)) {
    if (sessionDate! < startOfToday) {
      return "pending";
    }
    return "upcoming";
  }

  if (effectiveLifecycle === "active") {
    return "in_progress";
  }

  if (sessionDate! < startOfToday) {
    return "pending";
  }

  if (sessionDate! >= endOfToday) {
    return "upcoming";
  }

  return isInitial ? "upcoming" : "in_progress";
};

const AllSessions = () => {
  const { t: tForms } = useFormsTranslation();
  const { t, i18n } = useTranslation('pages');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<SessionSegment>('all');
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "session_date",
    direction: "asc",
  });
  const { data: sessionStatusData = [] } = useSessionStatuses();
  const navigate = useNavigate();
  const location = useLocation();
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      // Determine active organization first so we can scope queries properly
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const activeOrganizationId = await getUserOrganizationId();

      // Get sessions with proper validation using inner joins, scoped to org
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          leads!inner(id, name, status),
          projects(
            id, name, status_id,
            project_status:project_statuses!projects_status_id_fkey(id, name, color)
          )
        `)
        .eq('organization_id', activeOrganizationId as any)
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false });

      if (sessionsError) throw sessionsError;

      let filteredSessions = sessionsData || [];

      // Filter out archived projects from results (based on org's Archived status)
      if (activeOrganizationId) {
        const { data: archivedStatus } = await supabase
          .from('project_statuses')
          .select('id, name')
          .eq('organization_id', activeOrganizationId)
          .ilike('name', 'archived')
          .maybeSingle();

        filteredSessions = filteredSessions.filter((session) => {
          // Must have valid lead (inner join ensures this)
          if (!(session as any).leads) return false;

          // If session has a project, check if it's archived
          const proj = Array.isArray((session as any).projects)
            ? (session as any).projects[0]
            : (session as any).projects;
          if (session.project_id && proj) {
            if (archivedStatus?.id && proj.status_id === archivedStatus.id) {
              return false;
            }
          }

          return true;
        });
      }

      // Process sessions with enhanced data validation
      if (filteredSessions.length > 0) {
        const sessionsWithInfo = filteredSessions.map((session: any) => {
          const proj = Array.isArray(session.projects) ? session.projects[0] : session.projects;
          const statusObj = proj?.project_status
            ? (Array.isArray(proj.project_status) ? proj.project_status[0] : proj.project_status)
            : null;
          return {
            ...session,
            lead_name: session.leads?.name || 'Unknown Lead',
            lead_status: session.leads?.status || 'unknown',
            project_name: proj?.name || undefined,
            project_status_id: statusObj?.id ?? proj?.status_id ?? null,
            project_status: statusObj ?? null,
          } as Session;
        });
        setSessions(sessionsWithInfo);
      } else {
        setSessions([]);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching sessions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Refresh on focus/visibility with throttle to avoid request storms
  useThrottledRefetchOnFocus(fetchSessions, 30_000);

  const sessionStatuses = useMemo<SessionStatusRecord[]>(() => {
    return (sessionStatusData ?? []).map((status: any) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      lifecycle: status.lifecycle,
      is_system_initial: Boolean(status.is_system_initial),
    }));
  }, [sessionStatusData]);

  const statusLookup = useMemo(() => {
    const map = new Map<string, SessionStatusRecord>();
    sessionStatuses.forEach((status) => {
      map.set(normalizeStatusName(status.name), status);
    });
    return map;
  }, [sessionStatuses]);

  const computedSessions = useMemo<SessionWithComputed[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return sessions.map((session) => {
      const normalizedStatus = normalizeStatusName(session.status);
      const statusRecord = normalizedStatus ? statusLookup.get(normalizedStatus) ?? null : null;
      const lifecycleFromRecord = statusRecord ? normalizeLifecycle(statusRecord.lifecycle) : "unknown";
      let lifecycle = lifecycleFromRecord !== "unknown" ? lifecycleFromRecord : getFallbackLifecycle(session.status);
      const isInitial = statusRecord ? Boolean(statusRecord.is_system_initial) : lifecycle === "planned" || normalizedStatus === "planned";
      if (lifecycle === "unknown") {
        lifecycle = isInitial ? "planned" : "active";
      }
      const sessionDate = session.session_date ? new Date(session.session_date) : null;
      const hasValidDate = sessionDate && !Number.isNaN(sessionDate.getTime()) ? sessionDate : null;
      const segment = determineSegment(lifecycle, isInitial, hasValidDate, startOfToday, endOfToday);
      const color = statusRecord?.color ?? getFallbackColor(lifecycle, isInitial);
      const displayName = statusRecord?.name ?? session.status;

      return {
        ...session,
        statusId: statusRecord?.id ?? null,
        statusDisplayName: displayName,
        statusColor: color,
        statusLifecycle: lifecycle,
        statusIsInitial: isInitial,
        segment,
      } as SessionWithComputed;
    });
  }, [sessions, statusLookup]);

  const segmentCounts = useMemo(() => {
    const counts: Record<SessionSegment, number> = {
      all: 0,
      upcoming: 0,
      in_progress: 0,
      pending: 0,
      past: 0,
      cancelled: 0,
    };

    computedSessions.forEach((session) => {
      counts[session.segment] += 1;
    });

    counts.all = counts.upcoming + counts.in_progress + counts.pending;

    return counts;
  }, [computedSessions]);

  const sessionKpiMetrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    let pastNeedsAction = 0;
    let todayCount = 0;
    let futureCount = 0;

    computedSessions.forEach((session) => {
      const sessionDate = session.session_date ? new Date(session.session_date) : null;
      if (!sessionDate || Number.isNaN(sessionDate.getTime())) {
        return;
      }

      if (session.segment === 'pending') {
        pastNeedsAction += 1;
      }

      if (sessionDate >= startOfToday && sessionDate < endOfToday) {
        if (session.statusLifecycle !== 'cancelled') {
          todayCount += 1;
        }
        return;
      }

      if (sessionDate >= endOfToday) {
        if (session.statusLifecycle !== 'cancelled') {
          futureCount += 1;
        }
      }
    });

    return { pastNeedsAction, todayCount, futureCount };
  }, [computedSessions]);

  const { pastNeedsAction, todayCount, futureCount } = sessionKpiMetrics;

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language]
  );

  const formatCount = useCallback(
    (value: number) => numberFormatter.format(value),
    [numberFormatter]
  );

  const buildInfoLabel = useCallback(
    (metricKey: 'pastNeedsAction' | 'today' | 'future') =>
      t('sessions.kpis.infoLabel', {
        metric: t(`sessions.kpis.${metricKey}.title`),
      }),
    [t]
  );

  const pastPreset = useMemo(() => getKpiIconPreset('amber'), []);
  const todayPreset = useMemo(() => getKpiIconPreset('indigo'), []);
  const futurePreset = useMemo(() => getKpiIconPreset('sky'), []);

  const filteredAndSortedSessions = useMemo(() => {
    let filtered: SessionWithComputed[];

    switch (activeSegment) {
      case 'upcoming':
        filtered = computedSessions.filter((session) => session.segment === 'upcoming');
        break;
      case 'in_progress':
        filtered = computedSessions.filter((session) => session.segment === 'in_progress');
        break;
      case 'pending':
        filtered = computedSessions.filter((session) => session.segment === 'pending');
        break;
      case 'past':
        filtered = computedSessions.filter((session) => session.segment === 'past');
        break;
      case 'cancelled':
        filtered = computedSessions.filter((session) => session.segment === 'cancelled');
        break;
      case 'all':
      default:
        filtered = computedSessions.filter(
          (session) =>
            session.segment === 'upcoming' ||
            session.segment === 'in_progress' ||
            session.segment === 'pending'
        );
        break;
    }

    const sorted = [...filtered];
    const sortColumn = (sortState.columnId as string) ?? 'session_date';
    const directionMultiplier = sortState.direction === 'desc' ? -1 : 1;

    const compare = (a: SessionWithComputed, b: SessionWithComputed) => {
      switch (sortColumn) {
        case 'lead_name': {
          const aName = (a.lead_name || '').toLowerCase();
          const bName = (b.lead_name || '').toLowerCase();
          return aName.localeCompare(bName);
        }
        case 'session_time': {
          const aTime = a.session_time || '';
          const bTime = b.session_time || '';
          return aTime.localeCompare(bTime);
        }
        case 'status': {
          const aStatus = normalizeStatusName(a.statusDisplayName);
          const bStatus = normalizeStatusName(b.statusDisplayName);
          return aStatus.localeCompare(bStatus);
        }
        case 'session_date':
        default: {
          const aDate = a.session_date ? new Date(a.session_date).getTime() : 0;
          const bDate = b.session_date ? new Date(b.session_date).getTime() : 0;

          if (aDate !== bDate) {
            return aDate - bDate;
          }

          const aTime = a.session_time || '';
          const bTime = b.session_time || '';
          return aTime.localeCompare(bTime);
        }
      }
    };

    sorted.sort((a, b) => compare(a, b) * directionMultiplier);

    return sorted;
  }, [activeSegment, computedSessions, sortState]);

  const handleRowClick = (session: SessionWithComputed) => {
    setSelectedSessionId(session.id);
    setIsSessionSheetOpen(true);
  };

  const handleViewFullSessionDetails = () => {
    if (selectedSessionId) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      navigate(`/sessions/${selectedSessionId}`, { state: { from: currentPath } });
    }
  };

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleProjectClick = useCallback(async (e: React.MouseEvent, session: SessionWithComputed) => {
    e.stopPropagation();
    if (!session.project_id) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, lead_id, user_id, created_at, updated_at, status_id, previous_status_id, project_type_id')
        .eq('id', session.project_id)
        .single();
      if (error) throw error;

      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('name')
        .eq('id', data.lead_id)
        .single();
      if (leadError) throw leadError;

      setViewingProject({ ...data, leads: leadData });
      setShowProjectDialog(true);
    } catch (err: any) {
      toast({ title: 'Unable to open project', description: err.message, variant: 'destructive' });
    }
  }, []);

  const renderSegmentLabel = useCallback(
    (label: string, count: number) => (
      <span className="flex items-center gap-2">
        <span>{label}</span>
        <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {formatCount(count)}
        </span>
      </span>
    ),
    [formatCount]
  );

  const segmentOptions = useMemo(
    () => [
      {
        value: 'all',
        label: renderSegmentLabel(t('sessions.segments.all'), segmentCounts.all),
      },
      {
        value: 'upcoming',
        label: renderSegmentLabel(t('sessions.segments.upcoming'), segmentCounts.upcoming),
      },
      {
        value: 'in_progress',
        label: renderSegmentLabel(t('sessions.segments.inProgress'), segmentCounts.in_progress),
      },
      {
        value: 'pending',
        label: renderSegmentLabel(t('sessions.segments.pending'), segmentCounts.pending),
      },
      {
        value: 'past',
        label: renderSegmentLabel(t('sessions.segments.past'), segmentCounts.past),
      },
      {
        value: 'cancelled',
        label: renderSegmentLabel(t('sessions.segments.cancelled'), segmentCounts.cancelled),
      },
    ],
    [renderSegmentLabel, segmentCounts, t]
  );

  const columns = useMemo<AdvancedTableColumn<SessionWithComputed>[]>(
    () => [
      // 1) Kişi adı (Client Name)
      {
        id: 'lead_name',
        label: t('sessions.table.clientName'),
        accessorKey: 'lead_name',
        sortable: true,
        minWidth: '180px',
        cellClassName: 'whitespace-nowrap font-medium',
      },
      // 2) Tarih (Date)
      {
        id: 'session_date',
        label: t('sessions.table.date'),
        sortable: true,
        sortId: 'session_date',
        minWidth: '150px',
        render: (session) => <span className="whitespace-nowrap">{formatLongDate(session.session_date)}</span>,
      },
      // 3) Saat (Time)
      {
        id: 'session_time',
        label: t('sessions.table.time'),
        sortable: true,
        minWidth: '120px',
        render: (session) => <span className="whitespace-nowrap">{formatTime(session.session_time)}</span>,
      },
      // 4) Session Status
      {
        id: 'status',
        label: t('sessions.table.status'),
        sortable: true,
        minWidth: '180px',
        cellClassName: 'whitespace-nowrap',
        render: (session) => {
          const label = session.statusDisplayName || session.status || '';
          if (!label) {
            return <span className="text-muted-foreground">—</span>;
          }
          const color = session.statusColor || '#A0AEC0';
          return (
            <div
              className="inline-flex items-center gap-2 rounded-full border px-2 py-1"
              style={{
                backgroundColor: `${color}15`,
                color,
                borderColor: `${color}40`,
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
            </div>
          );
        },
      },
      // 5) Proje (Project)
      {
        id: 'project',
        label: t('sessions.table.project'),
        minWidth: '160px',
        render: (session) =>
          session.project_id ? (
            <Button
              variant="link"
              className="p-0 h-auto font-normal text-foreground hover:text-foreground hover:underline"
              onClick={(e) => handleProjectClick(e, session)}
            >
              {session.project_name || 'Project'}
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      // 6) Notes
      {
        id: 'notes',
        label: t('sessions.table.notes'),
        minWidth: '200px',
        render: (session) =>
          session.notes ? (
            <span
              className="block max-w-xs truncate text-muted-foreground"
              title={session.notes}
            >
              {session.notes}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [handleProjectClick, t]
  );

  const handleTableSortChange = useCallback(
    (next: AdvancedDataTableSortState) => {
      if (!next.columnId) {
        setSortState({ columnId: 'session_date', direction: 'asc' });
        return;
      }
      setSortState(next);
    },
    []
  );

  const emptyState = (
    <div className="text-center py-12 text-muted-foreground">
      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <h3 className="text-lg font-medium mb-2">{tForms('sessions.noSessionsFound')}</h3>
      <p>{tForms('sessions.noSessionsYet')}</p>
      <p className="text-sm mt-2">{tForms('sessions.clickToSchedule')}</p>
    </div>
  );

  const handleExportSessions = useCallback(async () => {
    if (exporting) return;

    if (filteredAndSortedSessions.length === 0) {
      toast({
        title: t('sessions.export.noDataTitle'),
        description: t('sessions.export.noDataDescription'),
      });
      return;
    }

    try {
      setExporting(true);

      const rows = filteredAndSortedSessions.map((session) => {
        const statusLabel = session.statusDisplayName || session.status || '';
        return {
        [t('sessions.table.clientName')]: session.lead_name ?? '',
        [t('sessions.table.date')]: session.session_date
          ? formatLongDate(session.session_date)
          : '',
        [t('sessions.table.time')]: session.session_time
          ? formatTime(session.session_time)
          : '',
        [t('sessions.table.project')]: session.project_name ?? '',
        [t('sessions.table.status')]: statusLabel,
        [t('sessions.table.notes')]: session.notes ?? '',
        };
      });

      const worksheet = XLSXUtils.json_to_sheet(rows);
      const workbook = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(workbook, worksheet, 'Sessions');

      const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
      writeFileXLSX(workbook, `sessions-${timestamp}.xlsx`);

      toast({
        title: t('sessions.export.successTitle'),
        description: t('sessions.export.successDescription'),
      });
    } catch (error) {
      console.error('Error exporting sessions', error);
      toast({
        title: t('sessions.export.errorTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('sessions.export.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    filteredAndSortedSessions,
    t,
    toast,
  ]);

  const exportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExportSessions}
        disabled={exporting || filteredAndSortedSessions.length === 0}
        className="hidden sm:inline-flex"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t('sessions.export.button')}</span>
      </Button>
    ),
    [
      exporting,
      filteredAndSortedSessions.length,
      handleExportSessions,
      t,
    ]
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PageHeader
        title={t('sessions.title')}
        subtitle={t('sessions.description')}
      >
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <NewSessionDialog onSessionScheduled={fetchSessions}>
              <Button
                size="sm"
                className="h-10 flex items-center gap-2 whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('sessions.addButton')}</span>
              </Button>
            </NewSessionDialog>
          </div>
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            className="h-full"
            density="compact"
            icon={AlertTriangle}
            {...pastPreset}
            title={t('sessions.kpis.pastNeedsAction.title')}
            value={formatCount(pastNeedsAction)}
            info={{
              content: t('sessions.kpis.pastNeedsAction.tooltip'),
              ariaLabel: buildInfoLabel('pastNeedsAction'),
            }}
          footer={
            <Button
              size="xs"
              variant="outline"
              className={KPI_ACTION_BUTTON_CLASS}
              onClick={() => {
                  setActiveSegment('pending');
                  setSortState({ columnId: 'session_date', direction: 'asc' });
                }}
            >
              {t('sessions.kpis.pastNeedsAction.action')}
            </Button>
            }
          />
          <KpiCard
            className="h-full"
            density="compact"
            icon={CalendarCheck2}
            {...todayPreset}
            title={t('sessions.kpis.today.title')}
            value={formatCount(todayCount)}
            info={{
              content: t('sessions.kpis.today.tooltip'),
              ariaLabel: buildInfoLabel('today'),
            }}
          footer={
            <Button
              size="xs"
              variant="outline"
              className={KPI_ACTION_BUTTON_CLASS}
              onClick={() => {
                  setActiveSegment('all');
                  setSortState({ columnId: 'session_date', direction: 'asc' });
                }}
            >
              {t('sessions.kpis.today.action')}
            </Button>
            }
          />
          <KpiCard
            className="h-full"
            density="compact"
            icon={CalendarClock}
            {...futurePreset}
            title={t('sessions.kpis.future.title')}
            value={formatCount(futureCount)}
            info={{
              content: t('sessions.kpis.future.tooltip'),
              ariaLabel: buildInfoLabel('future'),
            }}
          footer={
            <Button
              size="xs"
              variant="outline"
              className={KPI_ACTION_BUTTON_CLASS}
              onClick={() => {
                  setActiveSegment('upcoming');
                  setSortState({ columnId: 'session_date', direction: 'asc' });
                }}
            >
              {t('sessions.kpis.future.action')}
            </Button>
            }
          />
        </section>

        <div className="overflow-x-auto">
          <SegmentedControl
            value={activeSegment}
            onValueChange={(value) => setActiveSegment(value as SessionSegment)}
            options={segmentOptions}
            className="w-full"
          />
        </div>

        <AdvancedDataTable
          title={t('sessions.tableTitle')}
          data={filteredAndSortedSessions}
          columns={columns}
          rowKey={(session) => session.id}
          onRowClick={handleRowClick}
          sortState={sortState}
          onSortChange={handleTableSortChange}
          isLoading={loading}
          emptyState={emptyState}
          actions={exportActions}
        />

        <ViewProjectDialog
          project={viewingProject}
          open={showProjectDialog}
          onOpenChange={setShowProjectDialog}
          onProjectUpdated={fetchSessions}
          leadName={viewingProject?.leads?.name || ''}
        />

        {selectedSessionId && (
          <SessionSheetView
            sessionId={selectedSessionId}
            isOpen={isSessionSheetOpen}
            onOpenChange={setIsSessionSheetOpen}
            onViewFullDetails={handleViewFullSessionDetails}
            onNavigateToLead={handleNavigateToLead}
            onNavigateToProject={handleNavigateToProject}
          />
        )}
      </div>
    </div>
  );
};

export default AllSessions;
