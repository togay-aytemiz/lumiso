import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getEnvValue } from "@/lib/env";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  FileDown,
  Info,
  Loader2,
  Timer,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import NewSessionDialog from "@/components/NewSessionDialog";
import { formatTime, formatLongDate } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { ADD_ACTION_EVENTS } from "@/constants/addActionEvents";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSessionStatuses } from "@/hooks/useOrganizationData";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { EmptyState } from "@/components/EmptyState";
import { PageVideoModal } from "@/components/PageVideoModal";
import { usePageVideoPrompt } from "@/hooks/usePageVideoPrompt";

interface Session {
  id: string;
  lead_id: string;
  session_date: string | null;
  session_time: string | null;
  session_name?: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  project_id: string | null;
  project_name?: string;
  project_status_id?: string | null;
  project_status?: { id: string; name: string; color: string } | null;
  lead_name?: string;
  lead_status?: string | null;
}

type SessionLifecycle = 'active' | 'completed' | 'cancelled' | 'planned' | 'unknown';

type SessionSegment = 'all' | 'upcoming' | 'in_progress' | 'pending' | 'past' | 'cancelled';

interface SessionStatusRecord {
  id: string;
  name: string;
  color: string | null;
  lifecycle: string | null;
  is_system_initial: boolean;
  template_slug: string | null;
}

interface SessionWithComputed extends Session {
  statusId: string | null;
  statusDisplayName: string;
  statusColor: string;
  statusLifecycle: SessionLifecycle;
  statusIsInitial: boolean;
  segment: Exclude<SessionSegment, 'all'>;
}

const INITIAL_SESSION_BATCH = 25;

const normalizeStatusName = (value?: string | null) =>
  (value ?? '').trim().toLowerCase();

const firstOrNull = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] ?? null : null;
  }
  return value ?? null;
};

type SessionStatusResponse = {
  id: string;
  name: string;
  color: string | null;
  lifecycle: string | null;
  is_system_initial?: boolean | null;
  template_slug?: string | null;
};

type LeadRow = {
  id: string;
  name: string | null;
  status: string | null;
};

type ProjectStatusRow = {
  id: string;
  name: string | null;
  color: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  status_id: string | null;
  project_status: ProjectStatusRow | ProjectStatusRow[] | null;
};

type SessionRow = {
  id: string;
  lead_id: string;
  session_date: string | null;
  session_time: string | null;
  session_name?: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  project_id: string | null;
  leads: LeadRow | null;
  projects: ProjectRow | ProjectRow[] | null;
};

type ProjectDialogRow = {
  id: string;
  name: string | null;
  description: string | null;
  lead_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  status_id: string | null;
  previous_status_id: string | null;
  project_type_id: string | null;
};

type ProjectPreview = ProjectDialogRow & { leads: LeadNameRow | null };

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

  if (normalized === "planned" || normalized === "scheduled" || normalized === "preparing") {
    return "planned";
  }

  if (normalized === "in_progress") {
    return "active";
  }

  return "active";
};

const SESSIONS_VIDEO_ID =
  getEnvValue("VITE_SESSIONS_VIDEO_ID") || "811vc59bciM";

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
  const { t: tMessages } = useTranslation('messages');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [visibleSessionCount, setVisibleSessionCount] = useState(INITIAL_SESSION_BATCH);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<SessionSegment>('all');
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "session_date",
    direction: "asc",
  });
  const { data: sessionStatusData = [] } = useSessionStatuses();
  const navigate = useNavigate();
  const location = useLocation();
  const [viewingProject, setViewingProject] = useState<ProjectPreview | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isMobile = useIsMobile();
  const prevLoadingRef = useRef(true);
  const {
    isOpen: isSessionsVideoOpen,
    close: closeSessionsVideo,
    markCompleted: markSessionsVideoWatched,
    snooze: snoozeSessionsVideo
  } = usePageVideoPrompt({ pageKey: "sessions", snoozeDays: 1 });

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const activeOrganizationId = await getUserOrganizationId();

      if (!activeOrganizationId) {
        setSessions([]);
        return;
      }

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
        .eq('organization_id', activeOrganizationId)
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false });

      if (sessionsError) throw sessionsError;

      const sessionRows: SessionRow[] = (sessionsData ?? []) as SessionRow[];

      const { data: archivedStatus } = await supabase
        .from('project_statuses')
        .select('id, name')
        .eq('organization_id', activeOrganizationId)
        .ilike('name', 'archived')
        .maybeSingle();

      const filteredSessions = sessionRows.filter((session) => {
        if (!session.leads) {
          return false;
        }

        if (!session.project_id) {
          return true;
        }

        const project = firstOrNull(session.projects);
        if (!project) {
          return true;
        }

        if (archivedStatus?.id && project.status_id === archivedStatus.id) {
          return false;
        }

        return true;
      });

      const sessionsWithInfo: Session[] = filteredSessions.map((sessionRow) => {
        const project = firstOrNull(sessionRow.projects);
        const projectStatus = project ? firstOrNull(project.project_status) : null;
        const normalizedSessionName = (sessionRow.session_name ?? '').trim();

        return {
          id: sessionRow.id,
          lead_id: sessionRow.lead_id,
          session_date: sessionRow.session_date,
          session_time: sessionRow.session_time,
          session_name: normalizedSessionName || sessionRow.leads?.name || '',
          notes: sessionRow.notes,
          status: sessionRow.status,
          created_at: sessionRow.created_at,
          project_id: sessionRow.project_id,
          lead_name: sessionRow.leads?.name ?? 'Unknown Lead',
          lead_status: sessionRow.leads?.status ?? 'unknown',
          project_name: project?.name ?? undefined,
          project_status_id: projectStatus?.id ?? project?.status_id ?? null,
          project_status: projectStatus
            ? {
              id: projectStatus.id,
              name: projectStatus.name ?? '',
              color: projectStatus.color ?? '#A0AEC0',
            }
            : null,
        };
      });

      setSessions(sessionsWithInfo);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error fetching sessions',
        description: message,
        variant: 'destructive',
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

  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      setVisibleSessionCount(INITIAL_SESSION_BATCH);
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    setVisibleSessionCount(INITIAL_SESSION_BATCH);
  }, [activeSegment]);

  useEffect(() => {
    setVisibleSessionCount(INITIAL_SESSION_BATCH);
  }, [sortState.columnId, sortState.direction]);

  const sessionStatuses = useMemo<SessionStatusRecord[]>(() => {
    const statuses = (sessionStatusData ?? []) as SessionStatusResponse[];
    return statuses.map((status) => ({
      id: status.id,
      name: status.name,
      color: status.color ?? null,
      lifecycle: status.lifecycle ?? null,
      is_system_initial: Boolean(status.is_system_initial),
      template_slug: status.template_slug ?? null,
    }));
  }, [sessionStatusData]);

  const statusLookup = useMemo(() => {
    const map = new Map<string, SessionStatusRecord>();
    sessionStatuses.forEach((status) => {
      const slugKey = normalizeStatusName(status.template_slug);
      const nameKey = normalizeStatusName(status.name);

      if (slugKey && !map.has(slugKey)) {
        map.set(slugKey, status);
      }
      if (nameKey && !map.has(nameKey)) {
        map.set(nameKey, status);
      }
      if (status.id && !map.has(status.id)) {
        map.set(status.id, status);
      }
    });
    return map;
  }, [sessionStatuses]);

  const computedSessions = useMemo<SessionWithComputed[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return sessions.map((session) => {
      const normalizedStatus = normalizeStatusName(session.status);
      const statusRecord =
        statusLookup.get(normalizedStatus) ||
        (session.status ? statusLookup.get(session.status) ?? null : null);
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

      const computed: SessionWithComputed = {
        ...session,
        statusId: statusRecord?.id ?? null,
        statusDisplayName: displayName,
        statusColor: color,
        statusLifecycle: lifecycle,
        statusIsInitial: isInitial,
        segment,
      };

      return computed;
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
    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfWeek.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    let pastNeedsAction = 0;
    let todayCount = 0;
    let upcomingCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let completedThisWeek = 0;

    computedSessions.forEach((session) => {
      const sessionDate = session.session_date ? new Date(session.session_date) : null;
      if (!sessionDate || Number.isNaN(sessionDate.getTime())) {
        if (session.segment === 'in_progress') {
          inProgressCount += 1;
        }
        if (session.statusLifecycle === 'completed') {
          completedCount += 1;
        }
        return;
      }

      if (session.segment === 'pending') {
        pastNeedsAction += 1;
      }

      if (sessionDate >= startOfToday && sessionDate < endOfToday) {
        if (session.statusLifecycle !== 'cancelled') {
          todayCount += 1;
        }
        if (session.segment === 'in_progress') {
          inProgressCount += 1;
        }
        if (session.statusLifecycle === 'completed') {
          completedCount += 1;
          if (sessionDate >= startOfWeek && sessionDate < endOfWeek) {
            completedThisWeek += 1;
          }
        }
        return;
      }

      if (sessionDate >= endOfToday) {
        if (session.statusLifecycle !== 'cancelled') {
          upcomingCount += 1;
        }
      }

      if (session.segment === 'in_progress') {
        inProgressCount += 1;
      }

      if (session.statusLifecycle === 'completed') {
        completedCount += 1;
        if (sessionDate >= startOfWeek && sessionDate < endOfWeek) {
          completedThisWeek += 1;
        }
      }
    });

    return {
      pastNeedsAction,
      todayCount,
      upcomingCount,
      inProgressCount,
      completedCount,
      completedThisWeek,
    };
  }, [computedSessions]);

  const {
    pastNeedsAction,
    todayCount,
    upcomingCount,
    inProgressCount,
    completedCount,
    completedThisWeek,
  } = sessionKpiMetrics;
  const todayAndUpcomingTotal = todayCount + upcomingCount;

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language]
  );

  const formatCount = useCallback(
    (value: number) => numberFormatter.format(value),
    [numberFormatter]
  );

  const buildInfoLabel = useCallback(
    (metricKey: 'pastNeedsAction' | 'schedule' | 'inProgress' | 'completed') =>
      t('sessions.kpis.infoLabel', {
        metric: t(`sessions.kpis.${metricKey}.title`),
      }),
    [t]
  );

  const pastPreset = useMemo(() => getKpiIconPreset('amber'), []);
  const schedulePreset = useMemo(() => getKpiIconPreset('indigo'), []);
  const inProgressPreset = useMemo(() => getKpiIconPreset('sky'), []);
  const completedPreset = useMemo(() => getKpiIconPreset('emerald'), []);

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
        case 'session_name': {
          const aName = (a.session_name || '').toLowerCase();
          const bName = (b.session_name || '').toLowerCase();
          return aName.localeCompare(bName);
        }
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

  const totalSessionRows = filteredAndSortedSessions.length;

  const visibleSessions = useMemo(
    () => filteredAndSortedSessions.slice(0, visibleSessionCount),
    [filteredAndSortedSessions, visibleSessionCount]
  );

  const hasMoreSessions = visibleSessionCount < totalSessionRows;

  const handleLoadMoreSessions = useCallback(() => {
    setVisibleSessionCount((prev) => {
      if (prev >= totalSessionRows) {
        return prev;
      }
      return Math.min(prev + INITIAL_SESSION_BATCH, totalSessionRows);
    });
  }, [totalSessionRows]);

  const handleRowClick = (session: SessionWithComputed) => {
    if (isMobile) {
      navigate(`/sessions/${session.id}`);
      return;
    }
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
    if (isMobile) {
      navigate(`/projects/${session.project_id}`);
      return;
    }
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

      const projectData = data as ProjectDialogRow;
      const leadNameData = (leadData as LeadNameRow) ?? null;
      setViewingProject({ ...projectData, leads: leadNameData });
      setShowProjectDialog(true);
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : tMessages('error.generic');
      toast({
        title: tMessages('error.projectOpen'),
        description,
        variant: 'destructive'
      });
    }
  }, [isMobile, navigate, tMessages]);

  const renderSegmentLabel = useCallback(
    (label: string, count: number) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-medium leading-tight">{label}</span>
        <span className="inline-flex min-w-[1.75rem] justify-center rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[11px] font-semibold leading-none text-current shadow-sm transition-colors">
          {formatCount(count)}
        </span>
      </span>
    ),
    [formatCount]
  );

  const segmentTooltips = useMemo<Record<SessionSegment, string>>(
    () => ({
      all: t('sessions.segmentDetails.all.tooltip'),
      upcoming: t('sessions.segmentDetails.upcoming.tooltip'),
      in_progress: t('sessions.segmentDetails.in_progress.tooltip'),
      pending: t('sessions.segmentDetails.pending.tooltip'),
      past: t('sessions.segmentDetails.past.tooltip'),
      cancelled: t('sessions.segmentDetails.cancelled.tooltip'),
    }),
    [t]
  );

  const segmentSummaries = useMemo<Record<SessionSegment, string>>(
    () => ({
      all: t('sessions.segmentDetails.all.summary', {
        total: formatCount(segmentCounts.all),
      }),
      upcoming: t('sessions.segmentDetails.upcoming.summary', {
        total: formatCount(segmentCounts.upcoming),
      }),
      in_progress: t('sessions.segmentDetails.in_progress.summary', {
        total: formatCount(segmentCounts.in_progress),
      }),
      pending: t('sessions.segmentDetails.pending.summary', {
        total: formatCount(segmentCounts.pending),
      }),
      past: t('sessions.segmentDetails.past.summary', {
        total: formatCount(segmentCounts.past),
      }),
      cancelled: t('sessions.segmentDetails.cancelled.summary', {
        total: formatCount(segmentCounts.cancelled),
      }),
    }),
    [formatCount, segmentCounts, t]
  );

  const segmentBullets = useMemo<Record<SessionSegment, string[]>>(
    () => ({
      all: (t('sessions.segmentDetails.all.bullets', { returnObjects: true }) as string[]) ?? [],
      upcoming: (t('sessions.segmentDetails.upcoming.bullets', { returnObjects: true }) as string[]) ?? [],
      in_progress: (t('sessions.segmentDetails.in_progress.bullets', { returnObjects: true }) as string[]) ?? [],
      pending: (t('sessions.segmentDetails.pending.bullets', { returnObjects: true }) as string[]) ?? [],
      past: (t('sessions.segmentDetails.past.bullets', { returnObjects: true }) as string[]) ?? [],
      cancelled: (t('sessions.segmentDetails.cancelled.bullets', { returnObjects: true }) as string[]) ?? [],
    }),
    [t]
  );

  const activeSegmentSummary = useMemo(
    () => segmentSummaries[activeSegment],
    [activeSegment, segmentSummaries]
  );
  const activeSegmentBullets = useMemo(
    () => segmentBullets[activeSegment] ?? [],
    [activeSegment, segmentBullets]
  );

  const segmentOptions = useMemo(
    () => [
      {
        value: 'all',
        label: renderSegmentLabel(t('sessions.segments.all'), segmentCounts.all),
        ariaLabel: segmentSummaries.all,
        tooltip: segmentTooltips.all,
      },
      {
        value: 'upcoming',
        label: renderSegmentLabel(t('sessions.segments.upcoming'), segmentCounts.upcoming),
        ariaLabel: segmentSummaries.upcoming,
        tooltip: segmentTooltips.upcoming,
      },
      {
        value: 'in_progress',
        label: renderSegmentLabel(t('sessions.segments.inProgress'), segmentCounts.in_progress),
        ariaLabel: segmentSummaries.in_progress,
        tooltip: segmentTooltips.in_progress,
      },
      {
        value: 'pending',
        label: renderSegmentLabel(t('sessions.segments.pending'), segmentCounts.pending),
        ariaLabel: segmentSummaries.pending,
        tooltip: segmentTooltips.pending,
      },
      {
        value: 'past',
        label: renderSegmentLabel(t('sessions.segments.past'), segmentCounts.past),
        ariaLabel: segmentSummaries.past,
        tooltip: segmentTooltips.past,
      },
      {
        value: 'cancelled',
        label: renderSegmentLabel(t('sessions.segments.cancelled'), segmentCounts.cancelled),
        ariaLabel: segmentSummaries.cancelled,
        tooltip: segmentTooltips.cancelled,
      },
    ],
    [renderSegmentLabel, segmentCounts, segmentSummaries, segmentTooltips, t]
  );

  const segmentInsightLabel = t('sessions.segmentDetails.trigger');
  const segmentLifecycleNotice = t('sessions.segmentDetails.lifecycleNotice');

  const segmentInsight = useMemo(
    () => (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Info className="h-4 w-4" />
            <span>{segmentInsightLabel}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3">
          {activeSegmentSummary ? (
            <p className="text-sm font-semibold leading-tight text-foreground">
              {activeSegmentSummary}
            </p>
          ) : null}
          {activeSegmentBullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {activeSegmentBullets.map((bullet, index) => (
                <li key={`${activeSegment}-bullet-${index}`}>{bullet}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground/80">
            {segmentLifecycleNotice}
          </p>
        </PopoverContent>
      </Popover>
    ),
    [activeSegment, activeSegmentBullets, activeSegmentSummary, segmentInsightLabel, segmentLifecycleNotice]
  );

  const columns = useMemo<AdvancedTableColumn<SessionWithComputed>[]>(
    () => [
      // 1) Session name
      {
        id: 'session_name',
        label: t('sessions.table.sessionName'),
        sortable: true,
        accessorKey: 'session_name',
        minWidth: '200px',
        render: (session) =>
          session.session_name && session.session_name.trim().length > 0 ? (
            <span className="font-medium">{session.session_name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      // 2) Kişi adı (Client Name)
      {
        id: 'lead_name',
        label: t('sessions.table.clientName'),
        accessorKey: 'lead_name',
        sortable: true,
        minWidth: '180px',
        cellClassName: 'whitespace-nowrap font-medium',
      },
      // 3) Tarih (Date)
      {
        id: 'session_date',
        label: t('sessions.table.date'),
        sortable: true,
        sortId: 'session_date',
        minWidth: '150px',
        render: (session) => {
          const sessionDate = session.session_date ? new Date(session.session_date) : null;

          if (!sessionDate || Number.isNaN(sessionDate.getTime())) {
            return <span className="text-muted-foreground">—</span>;
          }

          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfToday = new Date(startOfToday);
          endOfToday.setDate(endOfToday.getDate() + 1);

          const startOfTomorrow = new Date(endOfToday);
          const endOfTomorrow = new Date(startOfTomorrow);
          endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

          const sessionTimeLabel = session.session_time ? formatTime(session.session_time) : undefined;

          if (sessionDate >= startOfToday && sessionDate < endOfToday) {
            const label = sessionTimeLabel
              ? t('sessions.table.dateChip.todayWithTime', { time: sessionTimeLabel })
              : t('sessions.table.dateChip.today');

            return (
              <Badge className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {label}
              </Badge>
            );
          }

          if (sessionDate >= startOfTomorrow && sessionDate < endOfTomorrow) {
            const label = sessionTimeLabel
              ? t('sessions.table.dateChip.tomorrowWithTime', { time: sessionTimeLabel })
              : t('sessions.table.dateChip.tomorrow');

            return (
              <Badge className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {label}
              </Badge>
            );
          }

          return <span className="whitespace-nowrap">{formatLongDate(session.session_date)}</span>;
        },
      },
      // 4) Saat (Time)
      {
        id: 'session_time',
        label: t('sessions.table.time'),
        sortable: true,
        minWidth: '120px',
        render: (session) => <span className="whitespace-nowrap">{formatTime(session.session_time)}</span>,
      },
      // 5) Session Status
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
              <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
            </div>
          );
        },
      },
      // 6) Proje (Project)
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
      // 7) Notes
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

  const emptyState = useMemo(() => {
    const getEmptyStateContent = () => {
      switch (activeSegment) {
        case 'upcoming':
          return {
            title: tForms('sessions.noUpcomingSessions', { defaultValue: 'No upcoming sessions found' }),
            description: tForms('sessions.clickToSchedule'),
          };
        case 'in_progress':
          return {
            title: tForms('sessions.noInProgressSessions', { defaultValue: 'No in progress sessions found' }),
            description: tForms('sessions.clickToSchedule'),
          };
        case 'pending':
          return {
            title: tForms('sessions.noPendingSessions', { defaultValue: 'No pending sessions found' }),
            description: tForms('sessions.clickToSchedule'),
          };
        case 'past':
          return {
            title: tForms('sessions.noPastSessions', { defaultValue: 'No past sessions found' }),
            description: '',
          };
        case 'cancelled':
          return {
            title: tForms('sessions.noCancelledSessions', { defaultValue: 'No cancelled sessions found' }),
            description: '',
          };
        default: // 'all'
          return {
            title: tForms('sessions.noSessionsYet'),
            description: tForms('sessions.clickToSchedule'),
          };
      }
    };

    const content = getEmptyStateContent();
    const showButton = activeSegment !== 'past' && activeSegment !== 'cancelled';

    return (
      <EmptyState
        icon={Calendar}
        iconVariant="pill"
        iconColor="emerald"
        title={content.title}
        description={content.description}
        action={
          showButton ? (
            <Button
              onClick={() => window.dispatchEvent(new CustomEvent(ADD_ACTION_EVENTS.session))}
              className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100"
            >
              {tForms('buttons.scheduleSession')}
            </Button>
          ) : undefined
        }
      />
    );
  }, [activeSegment, tForms]);

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
          [t('sessions.table.sessionName')]: session.session_name ?? '',
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
  ]);

  const exportButton = useMemo(
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

  const tableActions = useMemo(
    () => (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl
            value={activeSegment}
            onValueChange={(value) => setActiveSegment(value as SessionSegment)}
            options={segmentOptions}
          />
        </div>
        {exportButton}
      </div>
    ),
    [activeSegment, exportButton, segmentOptions]
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <NewSessionDialog
        onSessionScheduled={fetchSessions}
        openEvent={ADD_ACTION_EVENTS.session}
        showDefaultTrigger={false}
      />
      <PageHeader
        title={t('sessions.title')}
        helpTitle={t('sessions.video.title', { defaultValue: '2 dakikalık hızlı tur' })}
        helpDescription={t('sessions.video.description', {
          defaultValue: 'Oturum listenizden en iyi şekilde yararlanmak için kısa bir tur izleyin.'
        })}
        helpVideoId={SESSIONS_VIDEO_ID}
        helpVideoTitle={t('sessions.video.title', { defaultValue: 'See how Sessions works' })}
      >
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            {...schedulePreset}
            title={t('sessions.kpis.schedule.title')}
            value={formatCount(todayAndUpcomingTotal)}
            trend={{
              label: t('sessions.kpis.schedule.breakdown', {
                today: formatCount(todayCount),
                upcoming: formatCount(upcomingCount),
              }),
              tone: 'neutral',
              icon: (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-indigo-500"
                  aria-hidden="true"
                />
              ),
              ariaLabel: t('sessions.kpis.schedule.breakdownAria', {
                today: formatCount(todayCount),
                upcoming: formatCount(upcomingCount),
              }),
            }}
            info={{
              content: t('sessions.kpis.schedule.tooltip'),
              ariaLabel: buildInfoLabel('schedule'),
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
                {t('sessions.kpis.schedule.action')}
              </Button>
            }
          />
          <KpiCard
            className="h-full"
            density="compact"
            icon={Timer}
            {...inProgressPreset}
            title={t('sessions.kpis.inProgress.title')}
            value={formatCount(inProgressCount)}
            info={{
              content: t('sessions.kpis.inProgress.tooltip'),
              ariaLabel: buildInfoLabel('inProgress'),
            }}
            footer={
              <Button
                size="xs"
                variant="outline"
                className={KPI_ACTION_BUTTON_CLASS}
                onClick={() => {
                  setActiveSegment('in_progress');
                  setSortState({ columnId: 'session_date', direction: 'asc' });
                }}
              >
                {t('sessions.kpis.inProgress.action')}
              </Button>
            }
          />
          <KpiCard
            className="h-full"
            density="compact"
            icon={CheckCircle2}
            {...completedPreset}
            title={t('sessions.kpis.completed.title')}
            value={formatCount(completedCount)}
            trend={{
              label: t('sessions.kpis.completed.weeklySummary', {
                count: formatCount(completedThisWeek),
              }),
              tone: 'neutral',
              icon: (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              ),
              ariaLabel: t('sessions.kpis.completed.weeklySummaryAria', {
                count: formatCount(completedThisWeek),
              }),
            }}
            info={{
              content: t('sessions.kpis.completed.tooltip'),
              ariaLabel: buildInfoLabel('completed'),
            }}
            footer={
              <Button
                size="xs"
                variant="outline"
                className={KPI_ACTION_BUTTON_CLASS}
                onClick={() => {
                  setActiveSegment('past');
                  setSortState({ columnId: 'session_date', direction: 'desc' });
                }}
              >
                {t('sessions.kpis.completed.action')}
              </Button>
            }
          />
        </section>

        <AdvancedDataTable
          title={t('sessions.tableTitle')}
          description={segmentInsight}
          data={visibleSessions}
          columns={columns}
          rowKey={(session) => session.id}
          onRowClick={handleRowClick}
          sortState={sortState}
          onSortChange={handleTableSortChange}
          isLoading={loading}
          emptyState={emptyState}
          actions={tableActions}
          onLoadMore={hasMoreSessions ? handleLoadMoreSessions : undefined}
          hasMore={hasMoreSessions}
          isLoadingMore={false}
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
            onSessionUpdated={fetchSessions}
          />
        )}

        <PageVideoModal
          open={isSessionsVideoOpen}
          onClose={closeSessionsVideo}
          videoId={SESSIONS_VIDEO_ID}
          title={t("sessions.video.title", { defaultValue: "See how Sessions works" })}
          description={t("sessions.video.description", {
            defaultValue: "Watch a quick overview to make the most of your session list."
          })}
          labels={{
            remindMeLater: t("sessions.video.remindLater", { defaultValue: "Remind me later" }),
            dontShowAgain: t("sessions.video.dontShow", { defaultValue: "I watched, don't show again" })
          }}
          onSnooze={snoozeSessionsVideo}
          onDontShowAgain={markSessionsVideoWatched}
        />
      </div>
    </div>
  );
};

export default AllSessions;
