import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, LayoutGrid, List, Archive, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch, PageHeaderActions } from "@/components/ui/page-header";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { formatDate } from "@/lib/utils";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { useIsMobile } from "@/hooks/use-mobile";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
import { Calendar, MessageSquare, CheckSquare } from "lucide-react";
import { PageLoadingSkeleton } from "@/components/ui/loading-presets";

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
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'archived'>('board');
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [quickViewProject, setQuickViewProject] = useState<Project | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { completeCurrentStep } = useOnboardingV2();
  const isMobile = useIsMobile();

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
    } else {
      setSortField('created_at');
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
  const { shouldLockNavigation, currentStepInfo } = useOnboardingV2();
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

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
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
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleProjectClick = (project: Project) => {
    // Navigate to full project page instead of showing dialog
    navigate(`/projects/${project.id}`);
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

    const displayServices = services.slice(0, 3);
    const overflowCount = services.length - 3;

    return (
      <div className="flex flex-wrap gap-1">
        {displayServices.map((service) => (
          <Badge key={service.id} variant="outline" className="text-xs">
            {service.name}
          </Badge>
        ))}
        {overflowCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{overflowCount}
          </Badge>
        )}
      </div>
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
      title: "Welcome to Your Project Management Hub",
      description: "Let's explore the three powerful ways to view and organize your photography projects.",
      content: <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          In this tutorial, you'll master the art of project management for photographers:
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">Board View - Visual workflow management with drag & drop</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">List View - Detailed project information in tables</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">Archived View - Completed projects organized separately</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-sm">Project status management and workflow optimization</span>
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
      disabledTooltip: isMobile ? undefined : "Drag a project from one column to another to continue",
      mode: "floating" as const,
    },
    {
      id: 3,
      title: "List View",
      description: "Click the 'List' tab above to see detailed project information in a table format.",
      content: "The list view is perfect when you need to see detailed information about multiple projects at once, with sorting and filtering capabilities. This view is great for analyzing project data and making informed decisions.",
      canProceed: hasClickedListView,
      requiresAction: true,
      disabledTooltip: "Click on the List tab above to continue",
      mode: "floating" as const,
    },
    {
      id: 4,
      title: "Archived Projects",
      description: "Click the 'Archived' tab above to see how completed projects are organized.",
      content: "The archived view keeps your workspace clean by separating completed projects from active ones. This helps you focus on current work while keeping past projects accessible for reference and portfolio building.",
      canProceed: hasClickedArchivedView,
      requiresAction: true,
      disabledTooltip: "Click on the Archived tab above to continue",
      mode: "floating" as const,
    },
    {
      id: 5,
      title: "You're All Set!",
      description: "Congratulations! You now understand all three project views and how to use them effectively.",
      content: <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You've successfully learned how to navigate between different project views:
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            <span className="text-sm">Board view for visual project management</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            <span className="text-sm">List view for detailed analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            <span className="text-sm">Archived view to review completed work</span>
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
    navigate('/getting-started');
  };

  const formatCurrency = (amount: string | number | null) => {
    const value = Number(amount || 0);
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
    } catch {
      return `${value.toFixed(2)} TRY`;
    }
  };

  if (loading && isInitialLoad) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="flex flex-col h-screen overflow-x-hidden">
      {/* Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Projects"
          subtitle="Manage all your projects in one place"
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
                  <span className="hidden sm:inline">Add Project</span>
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
                <span className="hidden sm:inline">Board</span>
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
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
            <button
              onClick={() => handleViewChange('archived')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                viewMode === 'archived' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Archived</span>
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">
                {archivedProjects.length}
              </span>
            </button>
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
            <Card className="w-full max-w-full">
              <CardContent className="pt-6 p-0 w-full max-w-full">
                {/* Table wrapper with horizontal scroll - headers stay outside */}
                <div className="w-full overflow-x-auto overflow-y-hidden" style={{ maxWidth: '100vw' }}>
                  <div className="min-w-max">
                    <Table style={{ minWidth: '800px' }}>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                            onClick={() => handleSort('lead_name')}
                          >
                            <div className="flex items-center gap-2">
                              Lead Name
                              {getSortIcon('lead_name')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-2">
                              Project Name
                              {getSortIcon('name')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                            onClick={() => handleSort('project_type')}
                          >
                            <div className="flex items-center gap-2">
                              Type
                              {getSortIcon('project_type')}
                            </div>
                          </TableHead>
                          {viewMode !== 'archived' ? (
                            <>
                              <TableHead 
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('status')}
                              >
                                <div className="flex items-center gap-2">
                                  Status
                                  {getSortIcon('status')}
                                </div>
                              </TableHead>
                              <TableHead className="whitespace-nowrap">Sessions</TableHead>
                              <TableHead className="whitespace-nowrap">Progress</TableHead>
                              <TableHead className="whitespace-nowrap">Services</TableHead>
                              <TableHead className="whitespace-nowrap">Assignees</TableHead>
                            </>
                           ) : (
                            <>
                              <TableHead className="whitespace-nowrap">Paid</TableHead>
                              <TableHead className="whitespace-nowrap">Remaining</TableHead>
                               <TableHead 
                                 className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                                 onClick={() => handleSort('updated_at')}
                               >
                                 <div className="flex items-center gap-2">
                                   Last Update
                                   {getSortIcon('updated_at')}
                                 </div>
                               </TableHead>
                             </>
                           )}
                           {viewMode !== 'archived' && (
                             <TableHead 
                               className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                               onClick={() => handleSort('created_at')}
                             >
                               <div className="flex items-center gap-2">
                                 Created
                                 {getSortIcon('created_at')}
                               </div>
                             </TableHead>
                           )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedProjects.length > 0 ? (
                          sortedProjects.map((project) => (
                            <TableRow key={project.id} className="hover:bg-muted/50">
                               <TableCell>
                                 <button
                                   onClick={() => project.lead?.id && handleLeadClick(project.lead.id)}
                                   className="font-medium text-left hover:underline cursor-pointer"
                                   disabled={!project.lead?.id}
                                 >
                                   {project.lead?.name || 'No Lead'}
                                 </button>
                               </TableCell>
                                <TableCell>
                                  <button
                                    onClick={() => handleQuickView(project)}
                                    className="font-medium text-left hover:underline cursor-pointer"
                                  >
                                    {project.name}
                                  </button>
                                </TableCell>
                              <TableCell>
                                {project.project_type ? (
                                  <Badge variant="outline" className="text-xs">
                                    {project.project_type.name}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                               </TableCell>
                               {viewMode !== 'archived' && (
                                 <TableCell>
                                   <ProjectStatusBadge
                                     projectId={project.id}
                                     currentStatusId={project.status_id ?? undefined}
                                     editable={true}
                                     size="sm"
                                     onStatusChange={fetchProjects}
                                   />
                                 </TableCell>
                               )}
                               {viewMode !== 'archived' ? (
                                 <>
                                    <TableCell>
                                      <div className="text-sm">
                                        <div>{project.session_count || 0} planned</div>
                                      </div>
                                    </TableCell>
                                   <TableCell>
                                     {getProgressBadge(project.completed_todo_count || 0, project.todo_count || 0)}
                                   </TableCell>
                                    <TableCell>
                                      {renderServicesChips(project.services || [])}
                                    </TableCell>
                                    <TableCell>
                                      {project.assignees && project.assignees.length > 0 ? (
                                        <AssigneeAvatars 
                                          assigneeIds={project.assignees} 
                                          maxVisible={3}
                                          size="sm"
                                        />
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                  </>
                                ) : (
                                 <>
                                   <TableCell>
                                     <span className="font-medium text-green-600">
                                       {formatCurrency(project.paid_amount || 0)}
                                     </span>
                                   </TableCell>
                                   <TableCell>
                                     <span className={project.remaining_amount && project.remaining_amount > 0 ? "font-medium text-orange-600" : "text-muted-foreground"}>
                                       {formatCurrency(project.remaining_amount || 0)}
                                     </span>
                                   </TableCell>
                                   <TableCell>
                                     {formatDate(project.updated_at)}
                                   </TableCell>
                                 </>
                                )}
                                {viewMode !== 'archived' && (
                                  <TableCell>
                                    {formatDate(project.created_at)}
                                  </TableCell>
                                )}
                            </TableRow>
                          ))
                        ) : (
                           <TableRow>
                             <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              No projects found. Create your first project to get started!
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                     </Table>
                   </div>
                 </div>
              </CardContent>
            </Card>
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