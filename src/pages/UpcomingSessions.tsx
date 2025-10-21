import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, AlertTriangle, CalendarCheck2, CalendarClock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import NewSessionDialog from "@/components/NewSessionDialog";
import { formatTime, formatLongDate, getWeekRange, cn } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
// Render project stage inline; no need to import ProjectStatusBadge here
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { FilterBar } from "@/components/FilterBar";
import SessionSheetView from "@/components/SessionSheetView";
import {
  AdvancedDataTable,
  type AdvancedTableColumn,
  type AdvancedDataTableSortState,
} from "@/components/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { getKpiIconPreset, KPI_ACTION_BUTTON_CLASS } from "@/components/ui/kpi-presets";

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

type DateFilterKey =
  | 'all'
  | 'past'
  | 'today'
  | 'tomorrow'
  | 'future'
  | 'thisweek'
  | 'nextweek'
  | 'thismonth'
  | 'nextmonth';

const DATE_FILTER_KEYS: DateFilterKey[] = [
  'all',
  'past',
  'today',
  'tomorrow',
  'thisweek',
  'nextweek',
  'thismonth',
  'nextmonth',
  'future',
];

const QUICK_DATE_FILTER_KEYS: DateFilterKey[] = ['all', 'today', 'tomorrow'];

interface DateFilterOption {
  key: DateFilterKey;
  label: string;
  count: number;
}

const AllSessions = () => {
  const { t: tForms } = useFormsTranslation();
  const { t, i18n } = useTranslation('pages');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("planned");
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("all");
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "session_date",
    direction: "asc",
  });
  const navigate = useNavigate();
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const isMobile = useIsMobile();

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

  const getDateRangeForFilter = (filter: DateFilterKey) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    switch (filter) {
      case 'past':
        return { start: new Date(0), end: startOfToday };
      case 'today':
        return { start: startOfToday, end: endOfToday };
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const startOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        const endOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1);
        return { start: startOfTomorrow, end: endOfTomorrow };
      case 'future':
        return {
          start: endOfToday,
          end: new Date(today.getFullYear() + 10, 0, 1),
        };
      case 'thisweek':
        return getWeekRange(today);
      case 'nextweek':
        const nextWeekDate = new Date(today);
        nextWeekDate.setDate(today.getDate() + 7);
        return getWeekRange(nextWeekDate);
      case 'thismonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      case 'nextmonth':
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
        return { start: nextMonthStart, end: nextMonthEnd };
      default:
        return null;
    }
  };

  const getSessionCountForDateFilter = (filter: DateFilterKey) => {
    let filtered = sessions;

    // Apply status filter first
    if (statusFilter !== "all") {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    // Then apply date filter
    if (filter === "all") {
      return filtered.length;
    }

    const dateRange = getDateRangeForFilter(filter);
    if (!dateRange) return 0;

    return filtered.filter(session => {
      const sessionDate = new Date(session.session_date);
      return sessionDate >= dateRange.start && sessionDate < dateRange.end;
    }).length;
  };

  const getDateFilterLabel = useCallback((filter: DateFilterKey) => {
    switch (filter) {
      case 'all':
        return t('sessions.filters.dateFilters.all');
      case 'past':
        return t('sessions.filters.dateFilters.past');
      case 'today':
        return t('sessions.filters.dateFilters.today');
      case 'tomorrow':
        return t('sessions.filters.dateFilters.tomorrow');
      case 'future':
        return t('sessions.filters.dateFilters.future');
      case 'thisweek':
        return t('sessions.filters.dateFilters.thisWeek');
      case 'nextweek':
        return t('sessions.filters.dateFilters.nextWeek');
      case 'thismonth':
        return t('sessions.filters.dateFilters.thisMonth');
      case 'nextmonth':
        return t('sessions.filters.dateFilters.nextMonth');
      default:
        return '';
    }
  }, [t]);

  const dateFilterOptions = useMemo<DateFilterOption[]>(
    () =>
      DATE_FILTER_KEYS.map((key) => ({
        key,
        label: getDateFilterLabel(key),
        count: getSessionCountForDateFilter(key),
      })),
    [getDateFilterLabel, sessions, statusFilter]
  );

  const quickDateFilters = useMemo<DateFilterOption[]>(
    () =>
      QUICK_DATE_FILTER_KEYS.map((key) =>
        dateFilterOptions.find((option) => option.key === key)
      ).filter((option): option is DateFilterOption => Boolean(option)),
    [dateFilterOptions]
  );

  const sessionKpiMetrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const safeParseDate = (value?: string) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    let pastNeedsAction = 0;
    let todayCount = 0;
    let futureCount = 0;

    sessions.forEach((session) => {
      const sessionDate = safeParseDate(session.session_date);
      if (!sessionDate) return;

      if (sessionDate < startOfToday) {
        if (session.status === "planned") {
          pastNeedsAction += 1;
        }
        return;
      }

      if (sessionDate >= endOfToday) {
        if (session.status !== "cancelled") {
          futureCount += 1;
        }
        return;
      }

      if (session.status !== "cancelled") {
        todayCount += 1;
      }
    });

    return { pastNeedsAction, todayCount, futureCount };
  }, [sessions]);

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
    let filtered = sessions;

    if (statusFilter !== "all") {
      filtered = filtered.filter((session) => session.status === statusFilter);
    }

    if (dateFilter !== "all") {
      const dateRange = getDateRangeForFilter(dateFilter);
      if (dateRange) {
        filtered = filtered.filter((session) => {
          const sessionDate = new Date(session.session_date);
          return sessionDate >= dateRange.start && sessionDate < dateRange.end;
        });
      }
    }

    const sorted = [...filtered];
    const sortColumn = (sortState.columnId as string) ?? "session_date";
    const directionMultiplier = sortState.direction === "desc" ? -1 : 1;

    const compare = (a: Session, b: Session) => {
      switch (sortColumn) {
        case "project_stage": {
          const aName = (a.project_status?.name || "").toLowerCase();
          const bName = (b.project_status?.name || "").toLowerCase();
          return aName.localeCompare(bName);
        }
        case "lead_name": {
          const aName = (a.lead_name || "").toLowerCase();
          const bName = (b.lead_name || "").toLowerCase();
          return aName.localeCompare(bName);
        }
        case "session_time": {
          const aTime = a.session_time || "";
          const bTime = b.session_time || "";
          return aTime.localeCompare(bTime);
        }
        case "status": {
          const aStatus = (a.status || "").toLowerCase();
          const bStatus = (b.status || "").toLowerCase();
          return aStatus.localeCompare(bStatus);
        }
        case "session_date":
        default: {
          const aDate = a.session_date ? new Date(a.session_date).getTime() : 0;
          const bDate = b.session_date ? new Date(b.session_date).getTime() : 0;

          if (aDate !== bDate) {
            return aDate - bDate;
          }

          const aTime = a.session_time || "";
          const bTime = b.session_time || "";
          return aTime.localeCompare(bTime);
        }
      }
    };

    sorted.sort((a, b) => compare(a, b) * directionMultiplier);

    return sorted;
  }, [sessions, statusFilter, dateFilter, sortState]);

  const handleRowClick = (session: Session) => {
    setSelectedSessionId(session.id);
    setIsSessionSheetOpen(true);
  };

  const handleViewFullSessionDetails = () => {
    if (selectedSessionId) {
      navigate(`/sessions/${selectedSessionId}`);
    }
  };

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleProjectClick = useCallback(async (e: React.MouseEvent, session: Session) => {
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

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t('sessions.filters.allStatuses') },
      { value: "planned", label: "Planned" },
      { value: "completed", label: "Completed" },
      { value: "in_post_processing", label: "Editing" },
      { value: "delivered", label: "Delivered" },
      { value: "cancelled", label: "Cancelled" },
    ],
    [t]
  );

  const statusOptionsForFilter = useMemo(
    () => statusOptions.map((option) => ({ key: option.value, label: option.label })),
    [statusOptions]
  );

  const summaryChips = useMemo(
    () => {
      const chips: { id: string; label: string }[] = [];
      if (statusFilter !== "all") {
        const statusLabel = statusOptions.find((option) => option.value === statusFilter)?.label;
        if (statusLabel) {
          chips.push({ id: 'status', label: `${t('sessions.table.status')}: ${statusLabel}` });
        }
      }
      if (dateFilter !== "all") {
        const dateLabel = dateFilterOptions.find((option) => option.key === dateFilter)?.label;
        if (dateLabel) {
          chips.push({ id: 'date', label: `${t('sessions.table.date')}: ${dateLabel}` });
        }
      }
      return chips;
    },
    [statusFilter, statusOptions, t, dateFilter, dateFilterOptions]
  );

  const tableSummary = useMemo(
    () => (summaryChips.length > 0 ? { chips: summaryChips } : undefined),
    [summaryChips]
  );

  const columns = useMemo<AdvancedTableColumn<Session>[]>(
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
      // 4) Proje (Project)
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
      // 5) Project Stage (Durum)
      {
        id: 'project_stage',
        label: t('sessions.table.status'),
        sortable: true,
        sortId: 'project_stage',
        minWidth: '160px',
        render: (session) => {
          if (!session.project_id) return <span className="text-muted-foreground">—</span>;
          const ps = session.project_status;
          if (!ps) return <span className="text-muted-foreground">—</span>;
          const color = ps.color || '#A0AEC0';
          return (
            <div
              className="inline-flex items-center gap-2 rounded-full font-medium px-2 py-1"
              style={{
                backgroundColor: `${color}15`,
                color,
                border: `1px solid ${color}60`,
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs uppercase tracking-wide font-semibold">{ps.name}</span>
            </div>
          );
        },
        cellClassName: 'whitespace-nowrap',
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
    [fetchSessions, handleProjectClick, t]
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
      <p>
        {statusFilter === "all"
          ? tForms('sessions.noSessionsYet')
          : tForms('sessions.noSessionsWithStatus', { status: statusFilter })}
      </p>
      <p className="text-sm mt-2">{tForms('sessions.clickToSchedule')}</p>
    </div>
  );

  const filterPillBaseClasses =
    "h-8 rounded-full px-3 border border-border/60 bg-background text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";
  const filterPillActiveClasses =
    "bg-primary/10 text-primary border-primary/40 shadow-sm hover:bg-primary/15";
  const filterPillBadgeBaseClasses =
    "ml-2 h-5 min-w-[2rem] rounded-full border border-border/50 bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors";
  const filterPillBadgeActiveClasses =
    "border-primary/30 bg-primary/15 text-primary";

  const toolbarContent = (
    <div className="hidden md:flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap gap-2">
        {dateFilterOptions.map((option) => (
          <Button
            key={option.key}
            variant="outline"
            size="sm"
            className={cn(
              filterPillBaseClasses,
              dateFilter === option.key && filterPillActiveClasses
            )}
            onClick={() => setDateFilter(option.key)}
          >
            <span>{option.label}</span>
            <Badge
              variant="outline"
              className={cn(
                filterPillBadgeBaseClasses,
                dateFilter === option.key && filterPillBadgeActiveClasses
              )}
            >
              {option.count}
            </Badge>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {t('sessions.filters.statusLabel')}
        </span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
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
                  setDateFilter('past');
                  setStatusFilter('planned');
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
                  setDateFilter('today');
                  setStatusFilter('all');
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
                  setDateFilter('future');
                  setStatusFilter('planned');
                  setSortState({ columnId: 'session_date', direction: 'asc' });
                }}
              >
                {t('sessions.kpis.future.action')}
              </Button>
            }
          />
        </section>

        <div className="md:hidden">
          <FilterBar
            quickFilters={quickDateFilters}
            activeQuickFilter={dateFilter}
            onQuickFilterChange={(value) => setDateFilter(value as DateFilterKey)}
            allDateFilters={dateFilterOptions}
            activeDateFilter={dateFilter}
            onDateFilterChange={(value) => setDateFilter(value as DateFilterKey)}
            statusOptions={statusOptionsForFilter}
            activeStatus={statusFilter}
            onStatusChange={setStatusFilter}
            isSticky
          />
        </div>

        <AdvancedDataTable
          data={filteredAndSortedSessions}
          columns={columns}
          rowKey={(session) => session.id}
          onRowClick={handleRowClick}
          sortState={sortState}
          onSortChange={handleTableSortChange}
          isLoading={loading}
          emptyState={emptyState}
          toolbar={toolbarContent}
          summary={isMobile ? tableSummary : undefined}
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
