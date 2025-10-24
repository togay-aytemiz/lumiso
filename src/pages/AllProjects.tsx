import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Plus, LayoutGrid, List, Archive, Settings, FileDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { writeFileXLSX, utils as XLSXUtils } from "xlsx/xlsx.mjs";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch, PageHeaderActions } from "@/components/ui/page-header";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { formatDate, isNetworkError } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { KanbanSettingsSheet } from "@/components/KanbanSettingsSheet";
import { useTranslation } from 'react-i18next';
import { useDashboardTranslation, useFormsTranslation } from '@/hooks/useTypedTranslation';
import {
  AdvancedDataTable,
  type AdvancedDataTableSortState,
  type AdvancedTableColumn,
} from "@/components/data-table";
import {
  useProjectsListFilters,
  useProjectsArchivedFilters,
  type ProjectsListFiltersState,
  type ProjectsArchivedFiltersState,
} from "@/pages/projects/hooks/useProjectsFilters";
import { useProjectTypes, useProjectStatuses, useServices } from "@/hooks/useOrganizationData";
import {
  useProjectsData,
  type ProjectSortDirection,
  type ProjectSortField,
} from "@/pages/projects/hooks/useProjectsData";
import type { ProjectListItem, ProjectStatusSummary } from "@/pages/projects/types";
import { startTimer } from "@/lib/debug";
import { useConnectivity } from "@/contexts/ConnectivityContext";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";

const AllProjects = () => {
  const [boardProjects, setBoardProjects] = useState<ProjectListItem[]>([]);
  // Default to list to avoid initial board mount flicker
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'archived'>(() => {
    if (typeof window !== 'undefined') {
      const urlView = new URLSearchParams(window.location.search).get('view');
      if (urlView === 'board' || urlView === 'list' || urlView === 'archived') return urlView;
      const stored = localStorage.getItem('projects:viewMode');
      if (stored === 'board' || stored === 'list' || stored === 'archived') return stored as any;
    }
    return 'list';
  });
  const [viewingProject, setViewingProject] = useState<ProjectListItem | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [quickViewProject, setQuickViewProject] = useState<ProjectListItem | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [sortField, setSortField] = useState<ProjectSortField>('created_at');
  const [sortDirection, setSortDirection] = useState<ProjectSortDirection>('desc');
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({ columnId: 'created_at', direction: 'desc' });
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedPageSize, setArchivedPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const { reportNetworkError, reportRecovery, registerRetry } = useConnectivity();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeCurrentStep } = useOnboarding();
  const isMobile = useIsMobile();
  const { t } = useTranslation(['pages', 'common']);
  const { t: tForms } = useFormsTranslation();
  const { t: tDashboard } = useDashboardTranslation();
  const { data: typeOptions = [] } = useProjectTypes();
  const { data: statusOptions = [], isLoading: statusesLoading } = useProjectStatuses();
  const { data: serviceOptions = [] } = useServices();

  const projectStatuses = useMemo<ProjectStatusSummary[]>(
    () =>
      (statusOptions ?? []).map((status: any) => ({
        id: status.id,
        name: status.name,
        color: status.color,
        sort_order: status.sort_order,
      })),
    [statusOptions]
  );

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  
  // Tutorial interaction tracking
  const [hasMovedProject, setHasMovedProject] = useState(false);
  const [hasClickedListView, setHasClickedListView] = useState(false);
  const [hasClickedArchivedView, setHasClickedArchivedView] = useState(false);

  // Update sort field when view mode changes
  useEffect(() => {
    if (viewMode === 'archived') {
      setSortField('updated_at');
      setSortState({ columnId: 'updated_at', direction: 'desc' });
    } else {
      setSortField('created_at');
      setSortState({ columnId: 'created_at', direction: 'desc' });
    }
    setSortDirection('desc');
  }, [viewMode]);

  // Handle tutorial launch (run once; avoid re-render loops)
  const tutorialInitRef = useRef(false);
  useEffect(() => {
    if (tutorialInitRef.current) return;
    tutorialInitRef.current = true;
    const tutorial = new URLSearchParams(window.location.search).get('tutorial');
    if (tutorial?.includes('true')) {
      setShowTutorial(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('tutorial');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Check if user is in guided mode but missing tutorial parameter
  const { shouldLockNavigation, currentStepInfo } = useOnboarding();
  useEffect(() => {
    if (shouldLockNavigation && currentStepInfo?.id === 4 && !showTutorial) {
      console.log('🔧 User in guided mode step 4 but no tutorial - redirecting with tutorial param');
      navigate('/projects?tutorial=true', { replace: true });
    }
  }, [shouldLockNavigation, currentStepInfo, showTutorial, navigate]);

  const handleTableSortChange = (next: AdvancedDataTableSortState) => {
    setSortState(next);
    const field = (next.columnId as ProjectSortField) ?? 'created_at';
    setSortField(field);
    setSortDirection(next.direction as ProjectSortDirection);
  };

  const stageOptionsForView = useMemo(
    () =>
      projectStatuses
        .filter((s) => (viewMode === 'list' ? (s.name || '').toLowerCase() !== 'archived' : true))
        .map((s) => ({ id: s.id, name: s.name })),
    [projectStatuses, viewMode]
  );

  const listFilterOptions = useMemo(
    () => ({
      types: typeOptions.map((t: any) => ({ id: t.id, name: t.name })),
      stages: stageOptionsForView,
      services: serviceOptions.map((s: any) => ({ id: s.id, name: s.name })),
    }),
    [serviceOptions, stageOptionsForView, typeOptions]
  );

  const {
    state: listFiltersState,
    filtersConfig: listFiltersConfig,
    activeCount: listActiveCount,
    summaryChips: listSummaryChips,
    reset: resetListFilters,
  } = useProjectsListFilters({
    typeOptions: listFilterOptions.types,
    stageOptions: listFilterOptions.stages,
    serviceOptions: listFilterOptions.services,
  });

  const {
    state: archivedFiltersState,
    filtersConfig: archivedFiltersConfig,
    activeCount: archivedActiveCount,
    summaryChips: archivedSummaryChips,
    reset: resetArchivedFilters,
  } = useProjectsArchivedFilters({
    typeOptions: listFilterOptions.types,
  });

  const handleNetworkError = useCallback(
    (error: unknown) => {
      if (isNetworkError(error) || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        reportNetworkError(error);
      }
    },
    [reportNetworkError]
  );

  const handleNetworkRecovery = useCallback(() => {
    reportRecovery();
  }, [reportRecovery]);

  const {
    listProjects,
    archivedProjects,
    listTotalCount,
    archivedTotalCount,
    listLoading,
    archivedLoading,
    refetch: refetchProjects,
    fetchProjectsData,
  } = useProjectsData({
    listPage,
    listPageSize,
    archivedPage,
    archivedPageSize,
    sortField,
    sortDirection,
    listFilters: listFiltersState,
    archivedFilters: archivedFiltersState,
    onNetworkError: handleNetworkError,
    onNetworkRecovery: handleNetworkRecovery,
  });

  // Throttle refresh on window focus/visibility changes
  useThrottledRefetchOnFocus(refetchProjects, 30_000);

  // Derived labels no longer used; header summary now handled by AdvancedDataTable

  // Header summary placeholders; defined after filtered rows below
  let listHeaderSummary: { text?: string; chips: typeof listSummaryChips };
  let archivedHeaderSummary: { text?: string; chips: typeof archivedSummaryChips };

  // Pagination: reset page when filters change
  useEffect(() => { setListPage(1); }, [listFiltersState]);
  useEffect(() => { setArchivedPage(1); }, [archivedFiltersState]);

  // Helpers moved above first usage to avoid TDZ errors
  const handleQuickView = useCallback((project: ProjectListItem) => {
    setQuickViewProject(project);
    setShowQuickView(true);
  }, []);

  const handleLeadClick = useCallback((leadId: string) => {
    navigate(`/leads/${leadId}`);
  }, [navigate]);

  const renderProgressCell = useCallback((row: ProjectListItem) => {
    const total = row.todo_count || 0;
    const completed = row.completed_todo_count || 0;
    const pending = Math.max(0, total - completed);
    const pendingTodos = (row.open_todos || []).filter(Boolean);

    const textClass = total === 0
      ? "text-muted-foreground"
      : pending === 0
      ? "text-green-600 font-medium"
      : "text-foreground";

    const label = `${completed}/${total}`;

    if (pendingTodos.length === 0) {
      return <span className={`text-sm ${textClass}`}>{label}</span>;
    }

    const toShow = pendingTodos.slice(0, 5);
    const remaining = pendingTodos.length - toShow.length;

    return (
      <HoverCard openDelay={120} closeDelay={100}>
        <HoverCardTrigger asChild>
          <span className={`cursor-help text-sm ${textClass}`} aria-label={`${pending} pending`}>
            {label}
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          sideOffset={8}
          className="max-w-xs space-y-1 p-3 text-xs leading-relaxed"
        >
          {toShow.map((todo) => (
            <div key={todo.id} className="truncate">• {todo.content}</div>
          ))}
          {remaining > 0 && (
            <div className="text-muted-foreground">+{remaining} more</div>
          )}
        </HoverCardContent>
      </HoverCard>
    );
  }, []);

  const formatServicesList = useCallback(
    (services: Array<{ id: string; name: string }> = []) =>
      services
        .map((service) => service?.name)
        .filter((name): name is string => Boolean(name && name.trim().length > 0))
        .join(", "),
    []
  );

  const renderServicesChips = useCallback(
    (services: Array<{ id: string; name: string }>) => {
      if (!services || services.length === 0) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }

      const validServices = services.filter((service) => Boolean(service?.name));

      if (validServices.length === 0) {
        return <span className="text-sm font-semibold text-foreground">{services.length}</span>;
      }

      const label = formatServicesList(validServices);

      return (
        <HoverCard openDelay={120} closeDelay={100}>
          <HoverCardTrigger asChild>
            <span
              className="cursor-help text-sm font-semibold text-foreground"
              aria-label={label}
            >
              {services.length}
            </span>
          </HoverCardTrigger>
          <HoverCardContent
            side="top"
            align="start"
            sideOffset={8}
            className="max-w-xs space-y-1 p-3 text-xs leading-relaxed"
          >
            {validServices.map((service) => (
              <div key={service.id}>{service.name}</div>
            ))}
          </HoverCardContent>
        </HoverCard>
      );
    },
    [formatServicesList]
  );

  const formatCurrency = useCallback((amount: string | number | null) => {
    const value = Number(amount || 0);
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
      }).format(value);
    } catch {
      return `${value.toFixed(2)} TRY`;
    }
  }, []);

  const listTableColumns = useMemo<AdvancedTableColumn<ProjectListItem>[]>(
    () => [
      {
        id: "lead_name",
        label: tForms("projects.table_columns.client"),
        sortable: true,
        sortId: "lead_name",
        accessor: (row) => row.lead?.name ?? "",
        render: (row: ProjectListItem) =>
          row.lead?.id ? (
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={(event) => {
                event.stopPropagation();
                handleLeadClick(row.lead!.id);
              }}
            >
              {row.lead?.name}
            </Button>
          ) : (
            <span className="text-muted-foreground">{t("projects.no_lead")}</span>
          ),
      },
      {
        id: "name",
        label: tForms("projects.table_columns.project_name"),
        sortable: true,
        sortId: "name",
        accessor: (row) => row.name ?? "",
        render: (row: ProjectListItem) => (
          <div>
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleQuickView(row);
              }}
            >
              {row.name}
            </Button>
            {row.description ? (
              <div className="text-xs text-muted-foreground">{row.description}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "project_type",
        label: tForms("projects.table_columns.project_type"),
        sortable: true,
        sortId: "project_type",
        accessor: (row) => row.project_type?.name ?? "",
        render: (row: ProjectListItem) =>
          row.project_type ? (
            <span className="text-sm text-foreground">{row.project_type.name}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "status",
        label: tForms("projects.table_columns.status"),
        sortable: true,
        sortId: "status",
        accessor: (row) => row.project_status?.name ?? "",
        render: (row: ProjectListItem) => (
          <ProjectStatusBadge
            projectId={row.id}
            currentStatusId={row.status_id ?? undefined}
            editable={false}
            size="sm"
            onStatusChange={refreshAll}
            statuses={projectStatuses}
            statusesLoading={statusesLoading}
          />
        ),
      },
      {
        id: "sessions",
        label: tForms("projects.table_columns.sessions"),
        accessor: (row) =>
          `${row.session_count || 0} ${tForms("projects.table_columns.sessions_planned")}`,
        render: (row: ProjectListItem) => (
          <div className="text-sm">
            {row.session_count || 0} {tForms("projects.table_columns.sessions_planned")}
          </div>
        ),
      },
      {
        id: "progress",
        label: tForms("projects.table_columns.progress"),
        accessor: (row) => `${row.completed_todo_count ?? 0}/${row.todo_count ?? 0}`,
        render: (row: ProjectListItem) => renderProgressCell(row),
      },
      {
        id: "services",
        label: tForms("projects.table_columns.services"),
        accessor: (row) => formatServicesList(row.services ?? []),
        render: (row: ProjectListItem) => renderServicesChips(row.services || []),
      },
      {
        id: "created_at",
        label: tForms("projects.table_columns.created"),
        sortable: true,
        sortId: "created_at",
        align: "right",
        accessor: (row) => formatDate(row.created_at),
        render: (row: ProjectListItem) => formatDate(row.created_at),
      },
    ],
    [
      formatServicesList,
      handleLeadClick,
      handleQuickView,
      projectStatuses,
      statusesLoading,
      renderServicesChips,
      renderProgressCell,
      t,
      tForms,
    ]
  );

  const archivedTableColumns = useMemo<AdvancedTableColumn<ProjectListItem>[]>(
    () => [
      {
        id: "lead_name",
        label: tForms("projects.table_columns.client"),
        sortable: true,
        sortId: "lead_name",
        accessor: (row) => row.lead?.name ?? "",
        render: (row: ProjectListItem) =>
          row.lead?.id ? (
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={(event) => {
                event.stopPropagation();
                handleLeadClick(row.lead!.id);
              }}
            >
              {row.lead?.name}
            </Button>
          ) : (
            <span className="text-muted-foreground">{t("projects.no_lead")}</span>
          ),
      },
      {
        id: "name",
        label: tForms("projects.table_columns.project_name"),
        sortable: true,
        sortId: "name",
        accessor: (row) => row.name ?? "",
        render: (row: ProjectListItem) => (
          <div>
            <Button
              variant="link"
              className="p-0 h-auto font-medium text-primary"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleQuickView(row);
              }}
            >
              {row.name}
            </Button>
            {row.description ? (
              <div className="text-xs text-muted-foreground">{row.description}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "project_type",
        label: tForms("projects.table_columns.project_type"),
        sortable: true,
        sortId: "project_type",
        accessor: (row) => row.project_type?.name ?? "",
        render: (row: ProjectListItem) =>
          row.project_type ? (
            <span className="text-sm text-foreground">{row.project_type.name}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "paid_amount",
        label: tForms("projects.table_columns.paid"),
        accessor: (row) => formatCurrency(row.paid_amount || 0),
        render: (row: ProjectListItem) => (
          <span className="font-medium text-green-600">
            {formatCurrency(row.paid_amount || 0)}
          </span>
        ),
      },
      {
        id: "remaining_amount",
        label: tForms("projects.table_columns.remaining"),
        accessor: (row) => formatCurrency(row.remaining_amount || 0),
        render: (row: ProjectListItem) => (
          <span
            className={
              row.remaining_amount && row.remaining_amount > 0
                ? "font-medium text-orange-600"
                : "text-muted-foreground"
            }
          >
            {formatCurrency(row.remaining_amount || 0)}
          </span>
        ),
      },
      {
        id: "updated_at",
        label: tForms("projects.table_columns.last_update"),
        sortable: true,
        sortId: "updated_at",
        align: "right",
        accessor: (row) => (row.updated_at ? formatDate(row.updated_at) : ""),
        render: (row: ProjectListItem) => (row.updated_at ? formatDate(row.updated_at) : ""),
      },
    ],
    [formatCurrency, handleLeadClick, handleQuickView, t, tForms]
  );

  const paginatedListRows = listProjects;
  const paginatedArchivedRows = archivedProjects;

  listHeaderSummary = useMemo(() => {
    const text = listActiveCount > 0
      ? t('leads.tableSummaryFiltered', { visible: listProjects.length, total: listTotalCount })
      : undefined;
    return { text, chips: listSummaryChips };
  }, [listActiveCount, listProjects.length, listSummaryChips, listTotalCount, t]);

  archivedHeaderSummary = useMemo(() => {
    const text = archivedActiveCount > 0
      ? t('leads.tableSummaryFiltered', { visible: archivedProjects.length, total: archivedTotalCount })
      : undefined;
    return { text, chips: archivedSummaryChips };
  }, [archivedActiveCount, archivedProjects.length, archivedSummaryChips, archivedTotalCount, t]);

  const handleExportProjects = useCallback(
    async (mode: 'list' | 'archived') => {
      if (exporting) return;

      const total = mode === 'list' ? listTotalCount : archivedTotalCount;
      if (total === 0) {
        toast({
          title: t('projects.export.noDataTitle'),
          description: t('projects.export.noDataDescription'),
        });
        return;
      }

      try {
        setExporting(true);

        const columnsForMode = mode === 'list' ? listTableColumns : archivedTableColumns;

        const visibleOrderedColumns = [...columnsForMode];

        const scope = mode === 'list' ? 'active' : 'archived';
        const CHUNK = 1000;
        const collected: ProjectListItem[] = [];
        for (let from = 0; from < total; from += CHUNK) {
          const to = Math.min(from + CHUNK - 1, total - 1);
          const { projects } = await fetchProjectsData(scope, { from, to, includeCount: false });
          collected.push(...projects);
        }

        const rows = collected.map((project) => {
          const row: Record<string, string | number> = {};
          visibleOrderedColumns.forEach((column) => {
            const header =
              typeof column.label === 'string' ? column.label : String(column.label);
            let value: unknown = '';
            if (column.accessor) {
              value = column.accessor(project);
            } else if (column.id === 'services') {
              value = formatServicesList(project.services ?? []);
            } else if (column.id === 'progress') {
              value = `${project.completed_todo_count ?? 0}/${project.todo_count ?? 0}`;
            } else if (column.id === 'sessions') {
              value = `${project.session_count || 0} ${tForms('projects.table_columns.sessions_planned')}`;
            } else if (column.id === 'created_at') {
              value = formatDate(project.created_at);
            } else if (column.id === 'updated_at') {
              value = project.updated_at ? formatDate(project.updated_at) : '';
            } else if (column.id === 'paid_amount') {
              value = formatCurrency(project.paid_amount || 0);
            } else if (column.id === 'remaining_amount') {
              value = formatCurrency(project.remaining_amount || 0);
            } else {
              value = (project as Record<string, unknown>)[column.id];
            }

            if (value == null) {
              row[header] = '';
            } else if (typeof value === 'number') {
              row[header] = value;
            } else {
              row[header] = String(value);
            }
          });
          return row;
        });

        const worksheet = XLSXUtils.json_to_sheet(rows);
        const workbook = XLSXUtils.book_new();
        XLSXUtils.book_append_sheet(
          workbook,
          worksheet,
          mode === 'list' ? 'Projects' : 'Archived Projects'
        );

        const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
        const suffix = mode === 'list' ? 'list' : 'archived';
        writeFileXLSX(workbook, `projects-${suffix}-${timestamp}.xlsx`);

        toast({
          title: t('projects.export.successTitle'),
          description: t('projects.export.successDescription'),
        });
      } catch (error) {
        console.error('Error exporting projects', error);
        toast({
          title: t('projects.export.errorTitle'),
          description:
            error instanceof Error
              ? error.message
              : t('projects.export.errorDescription'),
          variant: 'destructive',
        });
      } finally {
        setExporting(false);
      }
    },
    [
      archivedTableColumns,
      archivedTotalCount,
      exporting,
      fetchProjectsData,
      formatCurrency,
      formatServicesList,
      listTableColumns,
      listTotalCount,
      t,
      tForms,
      toast,
    ]
  );

  const listExportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleExportProjects('list')}
        disabled={exporting || listLoading || listProjects.length === 0}
        className="hidden sm:inline-flex"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t('projects.export.button')}</span>
      </Button>
    ),
    [exporting, handleExportProjects, listLoading, listProjects.length, t]
  );

  const archivedExportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleExportProjects('archived')}
        disabled={exporting || archivedLoading || archivedProjects.length === 0}
        className="hidden sm:inline-flex"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t('projects.export.button')}</span>
      </Button>
    ),
    [archivedLoading, archivedProjects.length, exporting, handleExportProjects, t]
  );

  // Prevent overlapping loads and debounce error toasts
  const boardLoadInFlightRef = useRef(false);
  const lastBoardErrorAtRef = useRef(0);
  const ERROR_TOAST_DEBOUNCE_MS = 8000;

  const loadBoardProjects = useCallback(async () => {
    try {
      if (boardLoadInFlightRef.current) return;
      boardLoadInFlightRef.current = true;
      setBoardLoading(true);
      const t = startTimer('Projects.boardLoad');
      const INITIAL_CHUNK = 200; // render first chunk quickly
      const BACKFILL_CHUNK = 600; // fewer background requests while still streaming results

      // First request gets initial data and total count
      const { projects: first, count } = await fetchProjectsData('active', {
        from: 0,
        to: INITIAL_CHUNK - 1,
        includeCount: true,
      });

      // Render immediately for perceived speed
      setBoardProjects(first);
      setBoardLoading(false);
      handleNetworkRecovery();

      // If there are more rows, fetch the remaining ranges in background with limited concurrency
      if (count > first.length) {
        const ranges: Array<{ from: number; to: number }> = [];
        for (let from = first.length; from < count; from += BACKFILL_CHUNK) {
          const to = Math.min(from + BACKFILL_CHUNK - 1, count - 1);
          ranges.push({ from, to });
        }

        let fetched = first.length;
        let idx = 0;
        const CONCURRENCY = 2;

        const runOne = async (): Promise<void> => {
          const current = ranges[idx++];
          if (!current) return;
          try {
            const { projects: chunk } = await fetchProjectsData('active', {
              from: current.from,
              to: current.to,
              includeCount: false,
            });
            if (chunk && chunk.length) {
              // Progressive append without blocking UI
              setBoardProjects((prev) => [...prev, ...chunk]);
              fetched += chunk.length;
            }
          } catch (err) {
            // Do not bubble up chunk errors; avoid triggering global offline banner
            console.error('Background board chunk fetch failed', err);
          } finally {
            if (idx < ranges.length) {
              await runOne();
            }
          }
        };

        await Promise.all(
          new Array(Math.min(CONCURRENCY, ranges.length))
            .fill(0)
            .map(() => runOne())
        );

        t.end({ total: fetched, chunks: Math.ceil(count / INITIAL_CHUNK) });
      } else {
        t.end({ total: first.length, chunks: 1 });
      }
    } catch (error) {
      console.error('Failed to load board projects', error);
      handleNetworkError(error);
      const offline = isNetworkError(error);
      if (!offline) {
        const now = Date.now();
        if (now - lastBoardErrorAtRef.current > ERROR_TOAST_DEBOUNCE_MS) {
          lastBoardErrorAtRef.current = now;
          toast({
            title: t('common:labels.error'),
            description: t('pages:projects.failedToLoadProjects'),
            variant: 'destructive',
          });
        }
      }
    } finally {
      setBoardLoading(false);
      boardLoadInFlightRef.current = false;
    }
  }, [fetchProjectsData, handleNetworkError, handleNetworkRecovery, t, toast]);

  useEffect(() => {
    if (viewMode === 'board') {
      loadBoardProjects();
    }
  }, [loadBoardProjects, viewMode]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refetchProjects(), loadBoardProjects()]);
  }, [loadBoardProjects, refetchProjects]);

  // Register this page's retry with the global connectivity system
  useEffect(() => {
    const unregister = registerRetry('projects:refreshAll', async () => {
      await refreshAll();
    });
    return unregister;
  }, [registerRetry, refreshAll]);

  const handleProjectClick = useCallback((project: ProjectListItem) => {
    setQuickViewProject(project);
    setShowQuickView(true);
  }, []);

  const handleViewFullDetails = useCallback(() => {
    if (quickViewProject) {
      navigate(`/projects/${quickViewProject.id}`);
      setShowQuickView(false);
    }
  }, [navigate, quickViewProject]);

  const handleViewChange = useCallback(
    (view: 'board' | 'list' | 'archived') => {
      setViewMode(view);
      try { localStorage.setItem('projects:viewMode', view); } catch {}
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        window.history.replaceState({}, '', url.toString());
      } catch {}

      if (view === 'board') {
        loadBoardProjects();
      }

      if (view === 'list') {
        setHasClickedListView(true);
      } else if (view === 'archived') {
        setHasClickedArchivedView(true);
      }
    },
    [loadBoardProjects]
  );

  const handleProjectUpdate = useCallback((updatedProject: ProjectListItem) => {
    setBoardProjects((prev) =>
      prev.map((project) => (project.id === updatedProject.id ? { ...project, ...updatedProject } : project))
    );
    setHasMovedProject(true);
  }, []);

  // Tutorial steps
  const tutorialSteps = [
    {
      id: 1,
      title: tForms('projects.welcomeTutorialTitle'),
      description: tForms('projects.welcomeTutorialDescription'),
      content: <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          In this tutorial, you'll master the art of project management for photographers:
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">{t('projects.board_view_benefit')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">{t('projects.list_view_benefit')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">{t('projects.archived_view_benefit')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">{t('projects.status_management_benefit')}</span>
          </div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 Each view serves a different purpose to help you stay organized and efficient with your photography projects.
          </p>
        </div>
      </div>,
      canProceed: true,
      mode: "modal" as const,
    },
    {
      id: 2,
      title: "Board View (Kanban Style)",
      description: isMobile ? "The board view shows your projects organized by stages in columns." : "Try moving a project between stages by dragging and dropping to continue.",
      content: isMobile 
        ? "This visual workflow shows projects in different stages. On mobile devices, tap on a project to change its status instead of dragging."
        : "The board view is perfect for visual project management. You can drag projects between columns to update their status. Try moving at least one project to a different stage to continue the tutorial.",
      canProceed: isMobile || hasMovedProject,
      requiresAction: !isMobile,
      disabledTooltip: isMobile ? undefined : tForms('projects.boardViewTooltip'),
      mode: "floating" as const,
    },
    {
      id: 3,
      title: tForms('projects.listViewTitle'),
      description: tForms('projects.listViewDescription'),
      content: tForms('projects.listViewContent'),
      canProceed: hasClickedListView,
      requiresAction: true,
      disabledTooltip: tForms('projects.listViewTooltip'),
      mode: "floating" as const,
    },
    {
      id: 4,
      title: tForms('projects.archivedTitle'),
      description: tForms('projects.archivedDescription'),
      content: tForms('projects.archivedContent'),
      canProceed: hasClickedArchivedView,
      requiresAction: true,
      disabledTooltip: tForms('projects.archivedTooltip'),
      mode: "floating" as const,
    },
    {
      id: 5,
      title: tForms('projects.completionTitle'),
      description: "Congratulations! You now understand all three project views and how to use them effectively.",
      content: <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You've successfully learned how to navigate between different project views:
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            <span className="text-sm">{t('projects.board_view_summary')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            <span className="text-sm">{t('projects.list_view_summary')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            <span className="text-sm">{t('projects.archived_view_summary')}</span>
          </div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">
            🎉 You're ready to continue setting up your photography business and schedule your first session!
          </p>
        </div>
      </div>,
      canProceed: true,
      mode: "modal" as const,
    }
  ];

  const handleTutorialComplete = async () => {
    try {
      await completeCurrentStep();
      setShowTutorial(false);
      navigate('/getting-started');
    } catch (error) {
      console.error('Error completing tutorial:', error);
      setShowTutorial(false);
    }
  };

  const handleTutorialExit = () => {
    setShowTutorial(false);
  };

  return (
    <div className="flex flex-col h-screen overflow-x-hidden">
      {/* Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title={tForms('projects.pageTitle')}
          subtitle={tForms('projects.pageSubtitle')}
        >
          <PageHeaderSearch>
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 min-w-0">
                <GlobalSearch />
              </div>
              <EnhancedProjectDialog onProjectCreated={refreshAll}>
                <Button 
                  size="sm"
                  className="h-10 flex items-center gap-2 whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
                  data-testid="add-project-button"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('common:buttons.add_project')}</span>
                </Button>
              </EnhancedProjectDialog>
            </div>
          </PageHeaderSearch>
        </PageHeader>
      </div>

      {/* Global offline banner lives in Layout */}

      {/* View Toggle - mobile friendly tabs */}
      <div className="flex-shrink-0 px-4 sm:px-6 pb-2">
        <div className="border-b border-border">
          <div className="flex items-center justify-between pb-0 overflow-x-auto">
            <div className="flex items-center gap-0">
              <button
                onClick={() => handleViewChange('board')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  viewMode === 'board'
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">{tForms('projects.board')}</span>
              </button>
              <button
                onClick={() => handleViewChange('list')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  viewMode === 'list' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">{tForms('projects.list')}</span>
              </button>
              <button
                onClick={() => handleViewChange('archived')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  viewMode === 'archived' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">{tForms('projects.archived')}</span>
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">
                  {archivedTotalCount}
                </span>
              </button>
            </div>
            
            {viewMode === 'board' && (
              <KanbanSettingsSheet>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 h-8 px-2 text-muted-foreground hover:bg-accent/5 hover:text-accent">
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:inline text-sm">{tForms('projects.boardSettings')}</span>
                </Button>
              </KanbanSettingsSheet>
            )}
          </div>
        </div>
      </div>

      {/* Content area - board manages its own scroll, lists get contained scroll */}
      <div className="flex-1 min-h-0">
        {viewMode === 'board' ? (
          <ProjectKanbanBoard
            projects={boardProjects}
            projectStatuses={projectStatuses}
            onProjectsChange={refreshAll}
            onProjectUpdate={handleProjectUpdate}
            onQuickView={handleQuickView}
            isLoading={boardLoading || statusesLoading}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4 sm:p-6">
            {viewMode === 'list' && (
              <AdvancedDataTable
                title={t('projects.list_view')}
                data={paginatedListRows}
                columns={listTableColumns}
                rowKey={(row) => row.id}
                onRowClick={handleProjectClick}
                sortState={sortState}
                onSortChange={handleTableSortChange}
                isLoading={listLoading}
                filters={listFiltersConfig}
                actions={listExportActions}
                summary={listHeaderSummary}
                pagination={{
                  page: listPage,
                  pageSize: listPageSize,
                  totalCount: listTotalCount,
                  onPageChange: setListPage,
                  onPageSizeChange: (size) => {
                    setListPageSize(size);
                    setListPage(1);
                  },
                  pageSizeOptions: [10, 25, 50, 100],
                }}
              />
            )}

            {viewMode === 'archived' && (
              <AdvancedDataTable
                title={t('projects.archived_view')}
                data={paginatedArchivedRows}
                columns={archivedTableColumns}
                rowKey={(row) => row.id}
                onRowClick={handleProjectClick}
                sortState={sortState}
                onSortChange={handleTableSortChange}
                isLoading={archivedLoading}
                filters={archivedFiltersConfig}
                actions={archivedExportActions}
                summary={archivedHeaderSummary}
                pagination={{
                  page: archivedPage,
                  pageSize: archivedPageSize,
                  totalCount: archivedTotalCount,
                  onPageChange: setArchivedPage,
                  onPageSizeChange: (size) => {
                    setArchivedPageSize(size);
                    setArchivedPage(1);
                  },
                  pageSizeOptions: [10, 25, 50, 100],
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Project Sheet View */}
      <ProjectSheetView
        project={quickViewProject}
        open={showQuickView}
        onOpenChange={setShowQuickView}
        onProjectUpdated={refreshAll}
        leadName={quickViewProject?.lead?.name || ""}
        mode="sheet"
        onViewFullDetails={handleViewFullDetails}
      />

      {/* View Project Dialog */}
      <ViewProjectDialog
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onProjectUpdated={refreshAll}
        onActivityUpdated={() => {}} // Not needed in this context
        leadName={viewingProject?.lead?.name || ""}
      />

      {/* Tutorial Component - positioned to not block view selector */}
      {showTutorial && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div className="pointer-events-auto">
            <OnboardingTutorial
              steps={tutorialSteps}
              isVisible={showTutorial}
              onComplete={handleTutorialComplete}
              onExit={handleTutorialExit}
              initialStepIndex={currentTutorialStep}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AllProjects;
