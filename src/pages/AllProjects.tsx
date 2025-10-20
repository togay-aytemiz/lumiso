import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, LayoutGrid, List, Archive, ArrowUpDown, ArrowUp, ArrowDown, Settings, FileDown, Loader2 } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Calendar, MessageSquare, CheckSquare } from "lucide-react";
import { PageLoadingSkeleton } from "@/components/ui/loading-presets";
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

interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
  project_type_id?: string | null;
  base_price?: number | null;
  sort_order?: number;
  lead: {
    id: string;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  project_status?: {
    id: string;
    name: string;
    color: string;
  } | null;
  project_type?: {
    id: string;
    name: string;
  } | null;
  session_count?: number;
  upcoming_session_count?: number;
  planned_session_count?: number;
  next_session_date?: string | null;
  todo_count?: number;
  completed_todo_count?: number;
  total_payment_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  services?: Array<{
    id: string;
    name: string;
  }>;
  assignees?: string[];
}

type SortField = 'name' | 'lead_name' | 'project_type' | 'status' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

const AllProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);
  const [projectStatusesLoading, setProjectStatusesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'archived'>('board');
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [quickViewProject, setQuickViewProject] = useState<Project | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({ columnId: 'created_at', direction: 'desc' });
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedPageSize, setArchivedPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { completeCurrentStep } = useOnboarding();
  const isMobile = useIsMobile();
  const { t } = useTranslation(['pages', 'common']);
  const { t: tForms } = useFormsTranslation();
  const { t: tDashboard } = useDashboardTranslation();
  const { data: typeOptions = [] } = useProjectTypes();
  const { data: statusOptions = [] } = useProjectStatuses();
  const { data: serviceOptions = [] } = useServices();

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

  useEffect(() => {
    fetchProjects();
  }, []);

  // Handle tutorial launch
  useEffect(() => {
    const tutorial = searchParams.get('tutorial');
    console.log('🔍 Tutorial check:', {
      tutorial,
      includes_true: tutorial?.includes('true'),
      currentURL: window.location.href,
      searchParams: searchParams.toString()
    });
    
    // Check if tutorial parameter contains 'true' (handles malformed URLs)
    if (tutorial?.includes('true')) {
      console.log('✅ Starting tutorial');
      setShowTutorial(true);
      // Clean up URL completely
      const url = new URL(window.location.href);
      url.searchParams.delete('tutorial');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // Check if user is in guided mode but missing tutorial parameter
  const { shouldLockNavigation, currentStepInfo } = useOnboarding();
  useEffect(() => {
    if (shouldLockNavigation && currentStepInfo?.id === 4 && !showTutorial) {
      console.log('🔧 User in guided mode step 4 but no tutorial - redirecting with tutorial param');
      navigate('/projects?tutorial=true', { replace: true });
    }
  }, [shouldLockNavigation, currentStepInfo, showTutorial, navigate]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleTableSortChange = (next: AdvancedDataTableSortState) => {
    setSortState(next);
    const field = (next.columnId as SortField) ?? 'created_at';
    setSortField(field);
    setSortDirection(next.direction as SortDirection);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const sortedProjects = (viewMode === 'archived' ? archivedProjects : projects).sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'lead_name':
        aValue = a.lead?.name || '';
        bValue = b.lead?.name || '';
        break;
      case 'project_type':
        aValue = a.project_type?.name || '';
        bValue = b.project_type?.name || '';
        break;
      case 'status':
        aValue = a.project_status?.name || '';
        bValue = b.project_status?.name || '';
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'updated_at':
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const stageOptionsForView = useMemo(
    () =>
      statusOptions
        .filter((s: any) => (viewMode === 'list' ? (s.name || '').toLowerCase() !== 'archived' : true))
        .map((s: any) => ({ id: s.id, name: s.name })),
    [statusOptions, viewMode]
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
    serviceOptions: listFilterOptions.services,
  });

  // Derived labels no longer used; header summary now handled by AdvancedDataTable

  // Header summary placeholders; defined after filtered rows below
  let listHeaderSummary: { text?: string; chips: typeof listSummaryChips };
  let archivedHeaderSummary: { text?: string; chips: typeof archivedSummaryChips };

  // Pagination: reset page when filters change
  useEffect(() => { setListPage(1); }, [listFiltersState]);
  useEffect(() => { setArchivedPage(1); }, [archivedFiltersState]);

  const applyListFilters = useCallback(
    (rows: Project[]) => {
      const f: ProjectsListFiltersState = listFiltersState;
      return rows.filter((p) => {
        if (f.types.length > 0 && (!p.project_type_id || !f.types.includes(p.project_type_id))) return false;
        if (f.stages.length > 0 && (!p.status_id || !f.stages.includes(p.status_id))) return false;

        switch (f.sessionPresence) {
          case 'none':
            if ((p.session_count || 0) !== 0) return false;
            break;
          case 'hasAny':
            if ((p.session_count || 0) === 0) return false;
            break;
          case 'hasPlanned':
            if ((p.planned_session_count || 0) === 0) return false;
            break;
          case 'hasUpcoming':
            if ((p.upcoming_session_count || 0) === 0) return false;
            break;
        }

        if (f.progress !== 'any') {
          const total = p.todo_count || 0;
          const completed = p.completed_todo_count || 0;
          const progress = total === 0 ? 0 : (completed / total) * 100;

          if (f.progress === 'not_started' && progress !== 0) {
            return false;
          }

          if (f.progress === 'in_progress' && (progress === 0 || progress === 100)) {
            return false;
          }

          if (f.progress === 'completed' && progress !== 100) {
            return false;
          }
        }

        if (f.services.length > 0) {
          const serviceIds = (p.services || []).map((s) => s.id);
          const hasAny = f.services.some((id) => serviceIds.includes(id));
          if (!hasAny) return false;
        }

        return true;
      });
    },
    [listFiltersState]
  );

  const applyArchivedFilters = useCallback(
    (rows: Project[]) => {
      const f: ProjectsArchivedFiltersState = archivedFiltersState;
      return rows.filter((p) => {
        if (f.types.length > 0 && (!p.project_type_id || !f.types.includes(p.project_type_id))) return false;

        if (f.services.length > 0) {
          const serviceIds = (p.services || []).map((s) => s.id);
          const hasAny = f.services.some((id) => serviceIds.includes(id));
          if (!hasAny) return false;
        }

        const remaining = p.remaining_amount ?? 0;

        switch (f.balancePreset) {
          case 'zero':
            if (Math.abs(remaining) > 0.01) return false;
            break;
          case 'due':
            if (!(remaining > 0.01)) return false;
            break;
          case 'credit':
            if (!(remaining < -0.01)) return false;
            break;
        }

        if (f.balanceMin !== null && remaining < f.balanceMin) return false;
        if (f.balanceMax !== null && remaining > f.balanceMax) return false;

        return true;
      });
    },
    [archivedFiltersState]
  );

  // Derived filtered and paginated datasets for list and archived
  const filteredListRows = useMemo(
    () => applyListFilters(sortedProjects),
    [applyListFilters, sortedProjects, listFiltersState]
  );
  const filteredArchivedRows = useMemo(
    () => applyArchivedFilters(sortedProjects),
    [applyArchivedFilters, sortedProjects, archivedFiltersState]
  );

  const paginatedListRows = useMemo(() => {
    const start = (listPage - 1) * listPageSize;
    return filteredListRows.slice(start, start + listPageSize);
  }, [filteredListRows, listPage, listPageSize]);

  const paginatedArchivedRows = useMemo(() => {
    const start = (archivedPage - 1) * archivedPageSize;
    return filteredArchivedRows.slice(start, start + archivedPageSize);
  }, [filteredArchivedRows, archivedPage, archivedPageSize]);

  // Now that filtered counts are known, compute summary strips
  listHeaderSummary = useMemo(() => {
    const text = listActiveCount > 0
      ? t('leads.tableSummaryFiltered', { visible: filteredListRows.length, total: sortedProjects.length })
      : undefined;
    return { text, chips: listSummaryChips };
  }, [filteredListRows.length, listActiveCount, listSummaryChips, sortedProjects.length, t]);

  archivedHeaderSummary = useMemo(() => {
    const text = archivedActiveCount > 0
      ? t('leads.tableSummaryFiltered', { visible: filteredArchivedRows.length, total: sortedProjects.length })
      : undefined;
    return { text, chips: archivedSummaryChips };
  }, [archivedActiveCount, archivedSummaryChips, filteredArchivedRows.length, sortedProjects.length, t]);

  const handleExportProjects = useCallback(
    async (mode: 'list' | 'archived') => {
      if (exporting) return;

      const source = mode === 'list' ? filteredListRows : filteredArchivedRows;
      if (source.length === 0) {
        toast({
          title: t('projects.export.noDataTitle'),
          description: t('projects.export.noDataDescription'),
        });
        return;
      }

      try {
        setExporting(true);

        const rows = source.map((project) => {
          const servicesLabel = (project.services ?? [])
            .map((service) => service.name)
            .filter(Boolean)
            .join(', ');

          const baseRow: Record<string, string | number> = {
            [tForms('projects.table_columns.project_name')]: project.name ?? '',
            [tForms('projects.table_columns.client')]: project.lead?.name ?? '',
            [tForms('projects.table_columns.project_type')]: project.project_type?.name ?? '',
            [tForms('projects.table_columns.status')]: project.project_status?.name ?? '',
            [tForms('projects.table_columns.services')]: servicesLabel,
            [tForms('projects.table_columns.created')]: formatDate(project.created_at),
          };

          if (mode === 'list') {
            return {
              ...baseRow,
              [tForms('projects.table_columns.sessions')]: project.session_count ?? 0,
              [tForms('projects.table_columns.progress')]: `${project.completed_todo_count ?? 0}/${project.todo_count ?? 0}`,
            };
          }

          return {
            ...baseRow,
            [tForms('projects.table_columns.paid')]: project.paid_amount ?? 0,
            [tForms('projects.table_columns.remaining')]: project.remaining_amount ?? 0,
            [tForms('projects.table_columns.last_update')]: project.updated_at
              ? formatDate(project.updated_at)
              : '',
          };
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
    [exporting, filteredArchivedRows, filteredListRows, t, tForms]
  );

  const listExportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleExportProjects('list')}
        disabled={exporting || loading || filteredListRows.length === 0}
        className="flex items-center gap-2"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t('projects.export.button')}</span>
      </Button>
    ),
    [exporting, filteredListRows.length, handleExportProjects, loading, t]
  );

  const archivedExportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleExportProjects('archived')}
        disabled={exporting || loading || filteredArchivedRows.length === 0}
        className="flex items-center gap-2"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t('projects.export.button')}</span>
      </Button>
    ),
    [exporting, filteredArchivedRows.length, handleExportProjects, loading, t]
  );

  const fetchProjects = async () => {
    try {
      setProjectStatusesLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Fetch all related data separately
      const projectIds = (projectsData || []).map(p => p.id);
      const leadIds = (projectsData || []).map(p => p.lead_id).filter(Boolean);
      
      const [sessionsData, todosData, servicesData, paymentsData, leadsData, projectStatusesData, projectTypesData] = await Promise.all([
        // Get session counts
        projectIds.length > 0 ? supabase
          .from('sessions')
          .select('project_id, status')
          .in('project_id', projectIds) : Promise.resolve({ data: [] }),
        
        // Get todo counts  
        projectIds.length > 0 ? supabase
          .from('todos')
          .select('project_id, is_completed')
          .in('project_id', projectIds) : Promise.resolve({ data: [] }),
          
        // Get services
        projectIds.length > 0 ? supabase
          .from('project_services')
          .select(`
            project_id,
            service:services(id, name)
          `)
          .in('project_id', projectIds) : Promise.resolve({ data: [] }),
          
        // Get payments
        projectIds.length > 0 ? supabase
          .from('payments')
          .select('project_id, amount, status')
          .in('project_id', projectIds) : Promise.resolve({ data: [] }),
          
        // Get leads
        leadIds.length > 0 ? supabase
          .from('leads')
          .select('id, name, status, email, phone')
          .in('id', leadIds) : Promise.resolve({ data: [] }),
          
        // Get project statuses
        supabase
          .from('project_statuses')
          .select('id, name, color, sort_order')
          .eq('organization_id', organizationId)
          .order('sort_order', { ascending: true }),
          
        // Get project types
        supabase
          .from('project_types')
          .select('id, name')
          .eq('organization_id', organizationId)
      ]);

      // Process the data to handle archived projects
      // Find the archived status ID
      const archivedStatus = (projectStatusesData.data || []).find(status => status.name.toLowerCase() === 'archived');
      const archivedStatusId = archivedStatus?.id;
      
      const activeProjects = (projectsData || []).filter(project => project.status_id !== archivedStatusId);
      const archived = (projectsData || []).filter(project => project.status_id === archivedStatusId);

      // Create count maps for efficient lookup
      const sessionCounts = (sessionsData.data || []).reduce((acc, session) => {
        if (!acc[session.project_id]) {
          acc[session.project_id] = { total: 0, upcoming: 0, planned: 0 };
        }
        acc[session.project_id].total++;
        if (session.status === 'upcoming') acc[session.project_id].upcoming++;
        if (session.status === 'planned') acc[session.project_id].planned++;
        return acc;
      }, {});

      const todoCounts = (todosData.data || []).reduce((acc, todo) => {
        if (!acc[todo.project_id]) {
          acc[todo.project_id] = { total: 0, completed: 0 };
        }
        acc[todo.project_id].total++;
        if (todo.is_completed) acc[todo.project_id].completed++;
        return acc;
      }, {});

      const projectServices = (servicesData.data || []).reduce((acc, ps) => {
        if (!acc[ps.project_id]) acc[ps.project_id] = [];
        if (ps.service) acc[ps.project_id].push(ps.service);
        return acc;
      }, {});

      const paymentTotals = (paymentsData.data || []).reduce((acc, payment) => {
        if (!acc[payment.project_id]) {
          acc[payment.project_id] = { paid: 0 };
        }
        if (payment.status === 'paid') {
          acc[payment.project_id].paid += Number(payment.amount || 0);
        }
        return acc;
      }, {});

      // Create lookup maps
      const leadsMap = (leadsData.data || []).reduce((acc, lead) => {
        acc[lead.id] = lead;
        return acc;
      }, {});
      
      const statusesMap = (projectStatusesData.data || []).reduce((acc, status) => {
        acc[status.id] = status;
        return acc;
      }, {});
      
      const typesMap = (projectTypesData.data || []).reduce((acc, type) => {
        acc[type.id] = type;
        return acc;
      }, {});

      // Store project statuses for reuse
      setProjectStatuses(projectStatusesData.data || []);

      setProjects(activeProjects.map(project => ({
        ...project,
        lead: leadsMap[project.lead_id] || null,
        project_status: statusesMap[project.status_id] || null,
        project_type: typesMap[project.project_type_id] || null,
        session_count: sessionCounts[project.id]?.total || 0,
        upcoming_session_count: sessionCounts[project.id]?.upcoming || 0,
        planned_session_count: sessionCounts[project.id]?.planned || 0,
        todo_count: todoCounts[project.id]?.total || 0,
        completed_todo_count: todoCounts[project.id]?.completed || 0,
        paid_amount: paymentTotals[project.id]?.paid || 0,
        remaining_amount: (Number(project.base_price || 0)) - (paymentTotals[project.id]?.paid || 0),
        services: projectServices[project.id] || []
      })) as Project[]);

      setArchivedProjects(archived.map(project => ({
        ...project,
        lead: leadsMap[project.lead_id] || null,
        project_status: statusesMap[project.status_id] || null,
        project_type: typesMap[project.project_type_id] || null,
        session_count: sessionCounts[project.id]?.total || 0,
        upcoming_session_count: sessionCounts[project.id]?.upcoming || 0,
        planned_session_count: sessionCounts[project.id]?.planned || 0,
        todo_count: todoCounts[project.id]?.total || 0,
        completed_todo_count: todoCounts[project.id]?.completed || 0,
        paid_amount: paymentTotals[project.id]?.paid || 0,
        remaining_amount: (Number(project.base_price || 0)) - (paymentTotals[project.id]?.paid || 0),
        services: projectServices[project.id] || []
      })) as Project[]);

    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: t('common:labels.error'),
        description: t('pages:projects.failedToLoadProjects'),
        variant: "destructive",
      });
    } finally {
      setProjectStatusesLoading(false);
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleProjectClick = (project: Project) => {
    setQuickViewProject(project);
    setShowQuickView(true);
  };

  const handleQuickView = (project: Project) => {
    setQuickViewProject(project);
    setShowQuickView(true);
  };

  const handleViewFullDetails = () => {
    if (quickViewProject) {
      navigate(`/projects/${quickViewProject.id}`);
      setShowQuickView(false);
    }
  };

  const handleLeadClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleSearchResult = (result: any) => {
    if (result.type === 'project') {
      navigate(`/projects/${result.id}`);
    } else if (result.type === 'lead') {
      navigate(`/leads/${result.id}`);
    }
  };

  const getProgressBadge = (completed: number, total: number) => {
    if (total === 0) return <span className="text-muted-foreground text-xs">0/0</span>;
    
    const percentage = (completed / total) * 100;
    const isComplete = percentage === 100;
    
    return (
      <Badge 
        variant={isComplete ? "default" : "secondary"}
        className={`text-xs ${isComplete ? 'bg-green-600 text-white' : ''}`}
      >
        {completed}/{total}
      </Badge>
    );
  };

  const renderServicesChips = (services: Array<{ id: string; name: string }>) => {
    if (!services || services.length === 0) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }

    const serviceNames = services.map((service) => service.name).filter(Boolean);
    const trigger = (
      <Badge
        variant="secondary"
        className="cursor-default px-2.5 py-1 text-xs font-semibold"
        aria-label={serviceNames.join(", ")}
      >
        {services.length}
      </Badge>
    );

    if (serviceNames.length === 0) {
      return trigger;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 p-3 text-xs leading-relaxed">
          {services.map((service) => (
            <div key={service.id}>{service.name}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  };

  const handleViewChange = (view: 'board' | 'list' | 'archived') => {
    setViewMode(view);
    
    // Track tutorial interactions
    if (view === 'list') {
      setHasClickedListView(true);
    } else if (view === 'archived') {
      setHasClickedArchivedView(true);
    }
  };

  const handleProjectUpdate = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    ));
    
    // Track project movement for tutorial
    setHasMovedProject(true);
  };

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

  const formatCurrency = (amount: string | number | null) => {
    const value = Number(amount || 0);
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
    } catch {
      return `${value.toFixed(2)} TRY`;
    }
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
              <EnhancedProjectDialog
                onProjectCreated={() => {
                  fetchProjects();
                }}
              >
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
                  {archivedProjects.length}
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
            projects={projects} 
            projectStatuses={projectStatuses}
            onProjectsChange={fetchProjects}
            onProjectUpdate={handleProjectUpdate}
            onQuickView={handleQuickView}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4 sm:p-6">
            {viewMode === 'list' && (
              <AdvancedDataTable
                title={t('projects.list_view')}
                data={paginatedListRows}
                columns={[
                  {
                    id: 'lead_name',
                    label: tForms('projects.table_columns.client'),
                    sortable: true,
                    sortId: 'lead_name',
                    render: (row: Project) => (
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
                        <span className="text-muted-foreground">{t('projects.no_lead')}</span>
                      )
                    ),
                  },
                  {
                    id: 'name',
                    label: tForms('projects.table_columns.project_name'),
                    sortable: true,
                    sortId: 'name',
                    render: (row: Project) => (
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
                    id: 'project_type',
                    label: tForms('projects.table_columns.project_type'),
                    sortable: true,
                    sortId: 'project_type',
                    render: (row: Project) =>
                      row.project_type ? (
                        <span className="text-sm text-foreground">{row.project_type.name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      ),
                  },
                  {
                    id: 'status',
                    label: tForms('projects.table_columns.status'),
                    sortable: true,
                    sortId: 'status',
                    render: (row: Project) => (
                      <ProjectStatusBadge
                        projectId={row.id}
                        currentStatusId={row.status_id ?? undefined}
                        editable={false}
                        size="sm"
                        onStatusChange={fetchProjects}
                        statuses={projectStatuses}
                        statusesLoading={projectStatusesLoading}
                      />
                    ),
                  },
                  {
                    id: 'sessions',
                    label: tForms('projects.table_columns.sessions'),
                    render: (row: Project) => (
                      <div className="text-sm">{row.session_count || 0} {tForms('projects.table_columns.sessions_planned')}</div>
                    ),
                  },
                  {
                    id: 'progress',
                    label: tForms('projects.table_columns.progress'),
                    render: (row: Project) => getProgressBadge(row.completed_todo_count || 0, row.todo_count || 0),
                  },
                  {
                    id: 'services',
                    label: tForms('projects.table_columns.services'),
                    render: (row: Project) => renderServicesChips(row.services || []),
                  },
                  {
                    id: 'created_at',
                    label: tForms('projects.table_columns.created'),
                    sortable: true,
                    sortId: 'created_at',
                    render: (row: Project) => formatDate(row.created_at),
                    align: 'right',
                  },
                ] as AdvancedTableColumn<Project>[]}
                rowKey={(row) => row.id}
                onRowClick={handleProjectClick}
                sortState={sortState}
                onSortChange={handleTableSortChange}
                filters={listFiltersConfig}
                columnCustomization={{ storageKey: 'projects.table.columns' }}
                actions={listExportActions}
                summary={listHeaderSummary}
                pagination={{
                  page: listPage,
                  pageSize: listPageSize,
                  totalCount: filteredListRows.length,
                  onPageChange: setListPage,
                  onPageSizeChange: (size) => { setListPageSize(size); setListPage(1); },
                  pageSizeOptions: [10, 25, 50, 100],
                }}
              />
            )}

            {viewMode === 'archived' && (
              <AdvancedDataTable
                title={t('projects.archived_view')}
                data={paginatedArchivedRows}
                columns={[
                  {
                    id: 'lead_name',
                    label: tForms('projects.table_columns.client'),
                    sortable: true,
                    sortId: 'lead_name',
                    render: (row: Project) => (
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
                        <span className="text-muted-foreground">{t('projects.no_lead')}</span>
                      )
                    ),
                  },
                  {
                    id: 'name',
                    label: tForms('projects.table_columns.project_name'),
                    sortable: true,
                    sortId: 'name',
                    render: (row: Project) => (
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
                    id: 'project_type',
                    label: tForms('projects.table_columns.project_type'),
                    sortable: true,
                    sortId: 'project_type',
                    render: (row: Project) =>
                      row.project_type ? (
                        <span className="text-sm text-foreground">{row.project_type.name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      ),
                  },
                  {
                    id: 'paid_amount',
                    label: tForms('projects.table_columns.paid'),
                    render: (row: Project) => <span className="font-medium text-green-600">{formatCurrency(row.paid_amount || 0)}</span>,
                  },
                  {
                    id: 'remaining_amount',
                    label: tForms('projects.table_columns.remaining'),
                    render: (row: Project) => (
                      <span className={row.remaining_amount && row.remaining_amount > 0 ? "font-medium text-orange-600" : "text-muted-foreground"}>
                        {formatCurrency(row.remaining_amount || 0)}
                      </span>
                    ),
                  },
                  {
                    id: 'updated_at',
                    label: tForms('projects.table_columns.last_update'),
                    sortable: true,
                    sortId: 'updated_at',
                    render: (row: Project) => formatDate(row.updated_at),
                    align: 'right',
                  },
                ] as AdvancedTableColumn<Project>[]}
                rowKey={(row) => row.id}
                onRowClick={handleProjectClick}
                sortState={sortState}
                onSortChange={handleTableSortChange}
                columnCustomization={{ storageKey: 'projects.archived.table.columns' }}
                filters={archivedFiltersConfig}
                actions={archivedExportActions}
                summary={archivedHeaderSummary}
                pagination={{
                  page: archivedPage,
                  pageSize: archivedPageSize,
                  totalCount: filteredArchivedRows.length,
                  onPageChange: setArchivedPage,
                  onPageSizeChange: (size) => { setArchivedPageSize(size); setArchivedPage(1); },
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
        onProjectUpdated={fetchProjects}
        leadName={quickViewProject?.lead?.name || ""}
        mode="sheet"
        onViewFullDetails={handleViewFullDetails}
      />

      {/* View Project Dialog */}
      <ViewProjectDialog
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onProjectUpdated={fetchProjects}
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
