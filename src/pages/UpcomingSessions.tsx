import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import NewSessionDialog from "@/components/NewSessionDialog";
import { formatTime, formatLongDate, getWeekRange } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { FilterBar } from "@/components/FilterBar";
import SessionSheetView from "@/components/SessionSheetView";
import {
  AdvancedDataTable,
  type AdvancedTableColumn,
  type AdvancedDataTableSortState,
} from "@/components/data-table";

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
  lead_name?: string;
  lead_status?: string;
}

type DateFilterKey =
  | 'all'
  | 'past'
  | 'today'
  | 'tomorrow'
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
];

const QUICK_DATE_FILTER_KEYS: DateFilterKey[] = ['all', 'today', 'tomorrow'];

interface DateFilterOption {
  key: DateFilterKey;
  label: string;
  count: number;
}

const AllSessions = () => {
  const { t: tForms } = useFormsTranslation();
  const { t } = useTranslation('pages');
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
      // Get sessions with proper validation using inner joins
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          leads!inner(id, name, status),
          projects(id, name, status_id)
        `)
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Filter out sessions with invalid references or archived projects
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      let filteredSessions = sessionsData || [];
      
      if (userId) {
        // Get user's active organization using the utility
        const { getUserOrganizationId } = await import('@/lib/organizationUtils');
        const activeOrganizationId = await getUserOrganizationId();

        if (!activeOrganizationId) {
          return sessionsData || [];
        }

        // Get archived status for filtering
        const { data: archivedStatus } = await supabase
          .from('project_statuses')
          .select('id, name')
          .eq('organization_id', activeOrganizationId)
          .ilike('name', 'archived')
          .maybeSingle();
          
        filteredSessions = filteredSessions.filter(session => {
          // Must have valid lead (inner join ensures this)
          if (!session.leads) return false;
          
          // If session has a project, check if it's archived
          if (session.project_id && session.projects) {
            if (archivedStatus?.id && session.projects.status_id === archivedStatus.id) {
              return false;
            }
          }
          
          return true;
        });
      }

      // Process sessions with enhanced data validation
      if (filteredSessions.length > 0) {
        const sessionsWithInfo = filteredSessions.map(session => ({
          ...session,
          lead_name: session.leads?.name || 'Unknown Lead',
          lead_status: session.leads?.status || 'unknown',
          project_name: session.projects?.name || undefined
        }));
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
      {
        id: 'lead_name',
        label: t('sessions.table.clientName'),
        accessorKey: 'lead_name',
        sortable: true,
        minWidth: '180px',
        cellClassName: 'whitespace-nowrap font-medium',
      },
      {
        id: 'session_date',
        label: t('sessions.table.date'),
        sortable: true,
        sortId: 'session_date',
        minWidth: '150px',
        render: (session) => <span className="whitespace-nowrap">{formatLongDate(session.session_date)}</span>,
      },
      {
        id: 'session_time',
        label: t('sessions.table.time'),
        sortable: true,
        minWidth: '120px',
        render: (session) => <span className="whitespace-nowrap">{formatTime(session.session_time)}</span>,
      },
      {
        id: 'status',
        label: t('sessions.table.status'),
        sortable: true,
        minWidth: '140px',
        render: (session) => (
          <SessionStatusBadge
            sessionId={session.id}
            currentStatus={session.status}
            editable
            size="sm"
            onStatusChange={fetchSessions}
          />
        ),
        cellClassName: 'whitespace-nowrap',
      },
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

  const toolbarContent = (
    <div className="hidden md:flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap gap-2">
        {dateFilterOptions.map((option) => (
          <Button
            key={option.key}
            variant={dateFilter === option.key ? "default" : "outline"}
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={() => setDateFilter(option.key)}
          >
            <span>{option.label}</span>
            <Badge variant="secondary" className="ml-2 h-5 min-w-[2rem] px-2 text-xs">
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
