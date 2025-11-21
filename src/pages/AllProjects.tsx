import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { LayoutGrid, List, Archive, Settings, FileDown, Loader2, FolderPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { writeFileXLSX, utils as XLSXUtils } from "xlsx/xlsx.mjs";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import { ProjectCreationWizardSheet } from "@/features/project-creation";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { ADD_ACTION_EVENTS } from "@/constants/addActionEvents";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { formatDate, isNetworkError } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { KanbanSettingsSheet } from "@/components/KanbanSettingsSheet";
import { useTranslation } from 'react-i18next';
import { useDashboardTranslation, useFormsTranslation } from '@/hooks/useTypedTranslation';
import { OnboardingChecklistItem } from "@/components/shared/OnboardingChecklistItem";
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
import { promoteProjectToTop } from "@/lib/projects/sortOrder";
import { useConnectivity } from "@/contexts/useConnectivity";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { EmptyState } from "@/components/EmptyState";

const VIEW_MODES = ["board", "list", "archived"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

const parseViewMode = (value?: string | null): ViewMode | null => {
  if (!value) return null;
  return VIEW_MODES.includes(value as ViewMode) ? (value as ViewMode) : null;
};

type StatusOption = {
  id: string;
  name: string;
  color?: string | null;
  sort_order?: number | null;
};

const isStatusOption = (value: unknown): value is StatusOption =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "name" in value &&
  typeof (value as { id: unknown }).id === "string" &&
  typeof (value as { name: unknown }).name === "string";

type NamedOption = { id: string; name: string };

const toNamedOptions = (items: unknown[]): NamedOption[] =>
  items.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "name" in item &&
      typeof (item as { id: unknown }).id === "string" &&
      typeof (item as { name: unknown }).name === "string"
    ) {
      const { id, name } = item as { id: string; name: string };
      return [{ id, name }];
    }
    return [];
  });

const AllProjects = () => {
  const [boardProjects, setBoardProjects] = useState<ProjectListItem[]>([]);
  // Default to board during tutorial; otherwise respect URL or saved preference
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tutorialParam = searchParams.get('tutorial');
      if (tutorialParam?.includes('true')) {
        return 'board';
      }

      const urlView = parseViewMode(searchParams.get('view'));
      if (urlView) return urlView;

      const stored = parseViewMode(localStorage.getItem('projects:viewMode'));
      if (stored) return stored;
    }
    return 'list';
  });
  const [viewingProject, setViewingProject] = useState<ProjectListItem | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [quickViewProject, setQuickViewProject] = useState<ProjectListItem | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [isProjectWizardOpen, setProjectWizardOpen] = useState(false);
  const [sortField, setSortField] = useState<ProjectSortField>('created_at');
  const [sortDirection, setSortDirection] = useState<ProjectSortDirection>('desc');
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({ columnId: 'created_at', direction: 'desc' });
  const [listPage, setListPage] = useState(1);
  const listPageSize = 25;
  const [archivedPage, setArchivedPage] = useState(1);
  const archivedPageSize = 25;
  const [exporting, setExporting] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const refreshAllRef = useRef<() => Promise<void> | void>(() => { });
  const { reportNetworkError, reportRecovery, registerRetry } = useConnectivity();
  const { activeOrganizationId } = useOrganization();
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

  const typeOptionItems = useMemo(() => toNamedOptions(typeOptions ?? []), [typeOptions]);
  const serviceOptionItems = useMemo(() => toNamedOptions(serviceOptions ?? []), [serviceOptions]);

  const projectStatuses = useMemo<ProjectStatusSummary[]>(() => {
    return (statusOptions ?? []).flatMap((status) => {
      if (!isStatusOption(status)) {
        return [];
      }
      return [
        {
          id: status.id,
          name: status.name,
          color: status.color ?? undefined,
          sort_order: status.sort_order ?? undefined,
        },
      ];
    });
  }, [statusOptions]);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [tutorialInitiated, setTutorialInitiated] = useState(false);

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

  // Handle tutorial launch (respond whenever query param is present)
  useEffect(() => {
    const tutorial = searchParams.get('tutorial');
    if (tutorial?.includes('true')) {
      setShowTutorial(true);
      setTutorialInitiated(true);
      setViewMode('board'); // start on board for tutorial, but allow user to switch afterward
      const url = new URL(window.location.href);
      url.searchParams.delete('tutorial');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // Check if user is in guided mode but missing tutorial parameter
  const { shouldLockNavigation, currentStepInfo } = useOnboarding();
  useEffect(() => {
    if (shouldLockNavigation && currentStepInfo?.id === 4 && !showTutorial && !tutorialInitiated) {
      setShowTutorial(true);
      setTutorialInitiated(true);
      setViewMode('board'); // keep tutorial on board view without URL churn
    }
  }, [shouldLockNavigation, currentStepInfo, showTutorial, tutorialInitiated]);

  // Allow navigation between views after initial tutorial start; no persistent forcing to board

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
      types: typeOptionItems,
      stages: stageOptionsForView,
      services: serviceOptionItems,
    }),
    [serviceOptionItems, stageOptionsForView, typeOptionItems]
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
    getCachedProjects,
    getCacheStatus,
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
  const refreshProjectsData = useCallback(async () => {
    if (typeof window !== "undefined" && activeOrganizationId) {
      window.localStorage.removeItem(`prefetch:projects:first:${activeOrganizationId}:active`);
    }
    setListPage(1);
    setArchivedPage(1);
    await refetchProjects();
  }, [activeOrganizationId, refetchProjects]);

  useThrottledRefetchOnFocus(refreshProjectsData, 30_000);

  // Derived labels no longer used; header summary now handled by AdvancedDataTable

  // Pagination: reset page when filters change
  useEffect(() => { setListPage(1); }, [listFiltersState]);
  useEffect(() => { setArchivedPage(1); }, [archivedFiltersState]);

  // Helpers moved above first usage to avoid TDZ errors
  const handleQuickView = useCallback((project: ProjectListItem) => {
    if (isMobile) {
      navigate(`/projects/${project.id}`);
      return;
    }
    setQuickViewProject(project);
    setShowQuickView(true);
  }, [isMobile, navigate]);

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

  const handleStatusRefresh = useCallback(() => {
    refreshAllRef.current?.();
  }, []);

  const listTableColumns = useMemo<AdvancedTableColumn<ProjectListItem>[]>(
    () => [
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
          </div>
        ),
      },
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
            onStatusChange={handleStatusRefresh}
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
      handleStatusRefresh,
      projectStatuses,
      renderProgressCell,
      renderServicesChips,
      statusesLoading,
      t,
      tForms,
    ]
  );

  const archivedTableColumns = useMemo<AdvancedTableColumn<ProjectListItem>[]>(
    () => [
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
          </div>
        ),
      },
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

  const listHasMore = paginatedListRows.length < listTotalCount;
  const archivedHasMore = paginatedArchivedRows.length < archivedTotalCount;

  const listIsLoadingMore = listLoading && listPage > 1;
  const archivedIsLoadingMore = archivedLoading && archivedPage > 1;

  const handleListLoadMore = useCallback(() => {
    if (listLoading || !listHasMore) return;
    const batchSize = listPageSize || 25;
    const totalPages = listTotalCount > 0 ? Math.ceil(listTotalCount / batchSize) : 0;
    if (totalPages && listPage >= totalPages) return;
    setListPage((prev) => prev + 1);
  }, [listHasMore, listLoading, listPage, listPageSize, listTotalCount]);

  const handleArchivedLoadMore = useCallback(() => {
    if (archivedLoading || !archivedHasMore) return;
    const batchSize = archivedPageSize || 25;
    const totalPages = archivedTotalCount > 0 ? Math.ceil(archivedTotalCount / batchSize) : 0;
    if (totalPages && archivedPage >= totalPages) return;
    setArchivedPage((prev) => prev + 1);
  }, [archivedHasMore, archivedLoading, archivedPage, archivedPageSize, archivedTotalCount]);

  const listHeaderSummary = useMemo(() => {
    const text = listActiveCount > 0
      ? t('leads.tableSummaryFiltered', { visible: listProjects.length, total: listTotalCount })
      : undefined;
    return { text, chips: listSummaryChips };
  }, [listActiveCount, listProjects.length, listSummaryChips, listTotalCount, t]);

  const archivedHeaderSummary = useMemo(() => {
    const text = archivedActiveCount > 0
      ? t('leads.tableSummaryFiltered', { visible: archivedProjects.length, total: archivedTotalCount })
      : undefined;
    return { text, chips: archivedSummaryChips };
  }, [archivedActiveCount, archivedProjects.length, archivedSummaryChips, archivedTotalCount, t]);

  const listEmptyState = (
    <EmptyState
      icon={FolderPlus}
      iconVariant="pill"
      iconColor="emerald"
      title={t('projects.listEmptyState.title')}
      description={t('projects.listEmptyState.description')}
      action={
        <Button
          onClick={() => setProjectWizardOpen(true)}
          className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100"
        >
          {t('projects.addProject')}
        </Button>
      }
    />
  );

  const archivedEmptyState = (
    <EmptyState
      icon={Archive}
      iconVariant="pill"
      iconColor="emerald"
      title={t('projects.listEmptyState.archivedTitle')}
      description={t('projects.listEmptyState.archivedDescription')}
    />
  );

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
  const boardStateRef = useRef<{ nextFrom: number; total: number | null }>({ nextFrom: 0, total: null });
  const BOARD_PAGE_SIZE = 200;
  const [boardHasMore, setBoardHasMore] = useState(false);
  const [boardLoadingMore, setBoardLoadingMore] = useState(false);

  const loadBoardProjects = useCallback(
    async ({ reset = false, force = false }: { reset?: boolean; force?: boolean } = {}) => {
      if (boardLoadInFlightRef.current) return;
      boardLoadInFlightRef.current = true;

      if (reset) {
        boardStateRef.current = { nextFrom: 0, total: null };
        setBoardProjects([]);
        setBoardHasMore(false);
      }

      const initialStatus = getCacheStatus('active');
      const isInitialLoad = reset || boardStateRef.current.nextFrom === 0;
      const shouldShowSpinner = isInitialLoad && (force || initialStatus.cached === 0);

      if (!force && isInitialLoad && initialStatus.hasFull && initialStatus.total > 0) {
        const cachedProjects = getCachedProjects('active');
        setBoardProjects(cachedProjects);
        setBoardHasMore(false);
        setBoardLoading(false);
        setBoardLoadingMore(false);
        handleNetworkRecovery();
        boardStateRef.current = {
          nextFrom: cachedProjects.length,
          total: initialStatus.total ?? cachedProjects.length,
        };
        boardLoadInFlightRef.current = false;
        return;
      }

      if (!force && !isInitialLoad && boardStateRef.current.total !== null && boardStateRef.current.nextFrom >= boardStateRef.current.total) {
        setBoardHasMore(false);
        boardLoadInFlightRef.current = false;
        return;
      }

      if (shouldShowSpinner) {
        setBoardLoading(true);
      } else if (!isInitialLoad) {
        setBoardLoadingMore(true);
      }

      if (isInitialLoad && initialStatus.cached > 0) {
        setBoardProjects(getCachedProjects('active'));
      }

      const from = boardStateRef.current.nextFrom;
      const to = from + BOARD_PAGE_SIZE - 1;
      const includeCount = isInitialLoad || boardStateRef.current.total === null;

      const timer = startTimer('Projects.boardLoad', {
        from,
        to,
        includeCount,
        force: force ? 'network' : 'auto',
      });

      try {
        const { projects, count, source } = await fetchProjectsData('active', {
          from,
          to,
          includeCount,
          forceNetwork: force,
        });
        const received = projects.length;
        const totalCount = includeCount ? count : boardStateRef.current.total ?? count ?? null;
        const resolvedTotal = typeof totalCount === 'number' ? totalCount : boardStateRef.current.total;
        const nextFrom =
          received === 0 && typeof resolvedTotal === 'number'
            ? resolvedTotal
            : from + received;

        boardStateRef.current = {
          nextFrom,
          total: typeof resolvedTotal === 'number' ? resolvedTotal : boardStateRef.current.total,
        };

        setBoardProjects((prev) => (isInitialLoad ? projects : [...prev, ...projects]));

        const hasMore =
          typeof boardStateRef.current.total === 'number'
            ? nextFrom < boardStateRef.current.total
            : received === BOARD_PAGE_SIZE;
        setBoardHasMore(hasMore);

        handleNetworkRecovery();
        timer.end({
          rows: received,
          total: typeof boardStateRef.current.total === 'number' ? boardStateRef.current.total : nextFrom,
          source,
        });
      } catch (error) {
        timer.end({ error: (error as Error)?.message ?? String(error) });
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
        setBoardLoadingMore(false);
        boardLoadInFlightRef.current = false;
      }
    },
    [ERROR_TOAST_DEBOUNCE_MS, BOARD_PAGE_SIZE, fetchProjectsData, getCacheStatus, getCachedProjects, handleNetworkError, handleNetworkRecovery, t]
  );

  const boardFilterSignature = useMemo(
    () =>
      JSON.stringify({
        list: listFiltersState,
        archived: archivedFiltersState,
        sortField,
        sortDirection,
      }),
    [archivedFiltersState, listFiltersState, sortDirection, sortField]
  );

  useEffect(() => {
    boardStateRef.current = { nextFrom: 0, total: null };
    setBoardProjects([]);
    setBoardHasMore(false);
    setBoardLoading(false);
    setBoardLoadingMore(false);
  }, [boardFilterSignature]);

  useEffect(() => {
    if (viewMode === 'board' && boardStateRef.current.nextFrom === 0) {
      loadBoardProjects({ reset: true });
    }
  }, [loadBoardProjects, viewMode]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshProjectsData(),
      loadBoardProjects({ reset: true, force: true }),
    ]);
  }, [loadBoardProjects, refreshProjectsData]);

  useEffect(() => {
    refreshAllRef.current = refreshAll;
  }, [refreshAll]);

  const handleProjectCreated = useCallback(
    async (project?: { id: string }) => {
      if (project?.id) {
        await promoteProjectToTop(project.id);
      }
      await refreshAll();
    },
    [refreshAll]
  );

  const loadMoreBoard = useCallback(() => {
    if (!boardHasMore) return;
    loadBoardProjects();
  }, [boardHasMore, loadBoardProjects]);

  // Register this page's retry with the global connectivity system
  useEffect(() => {
    const unregister = registerRetry('projects:refreshAll', async () => {
      await refreshAll();
    });
    return unregister;
  }, [registerRetry, refreshAll]);

  const handleProjectClick = useCallback((project: ProjectListItem) => {
    handleQuickView(project);
  }, [handleQuickView]);

  const handleViewFullDetails = useCallback(() => {
    if (quickViewProject) {
      navigate(`/projects/${quickViewProject.id}`);
      setShowQuickView(false);
    }
  }, [navigate, quickViewProject]);

  const handleViewChange = useCallback(
    (view: ViewMode) => {
      setViewMode(view);
      try {
        localStorage.setItem('projects:viewMode', view);
      } catch (error) {
        console.warn('Unable to persist projects view mode', error);
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        window.history.replaceState({}, '', url.toString());
      } catch (error) {
        console.warn('Unable to update projects view mode in URL', error);
      }

      if (view === 'list') {
        setHasClickedListView(true);
      } else if (view === 'archived') {
        setHasClickedArchivedView(true);
      }
    },
    []
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
          {t('projects.tutorial.welcome.subtitle')}
        </p>
        <div className="space-y-3">
          <OnboardingChecklistItem
            icon={LayoutGrid}
            title={tForms('projects.boardViewTitle')}
            description={t('projects.board_view_benefit')}
            titleClassName="text-sm font-semibold"
            descriptionClassName="text-sm"
          />
          <OnboardingChecklistItem
            icon={List}
            title={tForms('projects.listViewTitle')}
            description={t('projects.list_view_benefit')}
            titleClassName="text-sm font-semibold"
            descriptionClassName="text-sm"
          />
          <OnboardingChecklistItem
            icon={Archive}
            title={tForms('projects.archivedTitle')}
            description={t('projects.archived_view_benefit')}
            titleClassName="text-sm font-semibold"
            descriptionClassName="text-sm"
          />
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {t('projects.tutorial.exploreViews.subtitle')}
          </p>
        </div>
      </div>,
      canProceed: true,
      mode: "modal" as const,
    },
    {
      id: 2,
      title: tForms('projects.boardViewTitle'),
      description: isMobile ? tForms('projects.boardViewMobileDescription') : tForms('projects.boardViewDescription'),
      content: isMobile
        ? tForms('projects.boardViewMobileContent')
        : tForms('projects.boardViewContent'),
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
      description: tForms('projects.completionDescription'),
      content: <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {tForms('projects.completionIntro')}
        </p>
        <div className="space-y-3">
          <OnboardingChecklistItem
            icon={LayoutGrid}
            title={tForms('projects.boardViewTitle')}
            description={t('projects.board_view_summary')}
            titleClassName="text-sm font-semibold"
            descriptionClassName="text-sm"
          />
          <OnboardingChecklistItem
            icon={List}
            title={tForms('projects.listViewTitle')}
            description={t('projects.list_view_summary')}
            titleClassName="text-sm font-semibold"
            descriptionClassName="text-sm"
          />
          <OnboardingChecklistItem
            icon={Archive}
            title={tForms('projects.archivedTitle')}
            description={t('projects.archived_view_summary')}
            titleClassName="text-sm font-semibold"
            descriptionClassName="text-sm"
          />
        </div>
        <div className="p-3 bg-muted/40 border border-border/60 rounded-lg">
          <p className="text-sm text-foreground">
            {tForms('projects.completionCallout')}
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
    <>
      <ProjectCreationWizardSheet
        isOpen={isProjectWizardOpen}
        onOpenChange={setProjectWizardOpen}
        entrySource="projects"
        onProjectCreated={handleProjectCreated}
      />

      <div className="flex flex-col h-screen overflow-x-hidden">
        {/* Header */}
        <div className="flex-shrink-0">
          <PageHeader title={tForms('projects.pageTitle')}>
            <PageHeaderSearch>
              <GlobalSearch variant="header" />
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
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${viewMode === 'board'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">{tForms('projects.board')}</span>
                </button>
                <button
                  onClick={() => handleViewChange('list')}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${viewMode === 'list'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">{tForms('projects.list')}</span>
                </button>
                <button
                  onClick={() => handleViewChange('archived')}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${viewMode === 'archived'
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
              hasMore={boardHasMore}
              onLoadMore={boardHasMore ? loadMoreBoard : undefined}
              isLoadingMore={boardLoadingMore}
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
                  isLoading={listLoading && listPage === 1 && paginatedListRows.length === 0}
                  filters={listFiltersConfig}
                  actions={listExportActions}
                  summary={listHeaderSummary}
                  emptyState={listEmptyState}
                  onLoadMore={listHasMore ? handleListLoadMore : undefined}
                  hasMore={listHasMore}
                  isLoadingMore={listIsLoadingMore}
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
                  isLoading={archivedLoading && archivedPage === 1 && paginatedArchivedRows.length === 0}
                  filters={archivedFiltersConfig}
                  actions={archivedExportActions}
                  summary={archivedHeaderSummary}
                  emptyState={archivedEmptyState}
                  onLoadMore={archivedHasMore ? handleArchivedLoadMore : undefined}
                  hasMore={archivedHasMore}
                  isLoadingMore={archivedIsLoadingMore}
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
          onActivityUpdated={() => { }} // Not needed in this context
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
    </>
  );
};

export default AllProjects;
