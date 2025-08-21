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
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch, PageHeaderActions } from "@/components/ui/page-header";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { formatDate } from "@/lib/utils";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { OnboardingTutorial } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/hooks/useOnboarding";

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
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { completeStep } = useOnboarding();

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);

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
    if (tutorial === 'true') {
      setShowTutorial(true);
      // Remove tutorial param from URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('tutorial');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
    setViewingProject(project);
    setShowViewDialog(true);
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

  const formatCurrency = (amount: string | number | null) => {
    const value = Number(amount || 0);
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
    } catch {
      return `${value.toFixed(2)} TRY`;
    }
  };

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
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
                onClick={() => setViewMode('board')}
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
                onClick={() => setViewMode('list')}
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
              onClick={() => setViewMode('archived')}
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
                                   onClick={() => handleProjectClick(project)}
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

      {/* View Project Dialog */}
      <ViewProjectDialog
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onProjectUpdated={fetchProjects}
        onActivityUpdated={() => {}} // Not needed in this context
        leadName={viewingProject?.lead?.name || ""}
      />

      {/* Tutorial Component */}
      <OnboardingTutorial
        isVisible={showTutorial}
        steps={[
          {
            id: 1,
            title: "Welcome to Projects",
            description: "Here you can manage all your photography projects in one organized place.",
            content: "This is your project hub where you can track progress, manage sessions, and collaborate with clients.",
            canProceed: true,
            mode: "modal"
          },
          {
            id: 2,
            title: "Board View",
            description: "The Kanban board shows projects organized by status columns. You can drag and drop projects between columns to update their status.",
            content: "Perfect for visual project management - just like organizing physical cards on a board!",
            canProceed: viewMode === 'board',
            disabledTooltip: "Click on the Board tab above to continue",
            mode: "floating"
          },
          {
            id: 3,
            title: "List View",
            description: "The list view displays detailed project information in a table format with sorting and filtering options.",
            content: "Great for detailed analysis and when you need to see multiple project details at once.",
            canProceed: viewMode === 'list',
            disabledTooltip: "Click on the List tab above to continue",
            mode: "floating"
          },
          {
            id: 4,
            title: "Archived Projects",
            description: "View completed or archived projects separately to keep your active workspace clean.",
            content: "Perfect for reviewing past work and maintaining a clear focus on current projects.",
            canProceed: viewMode === 'archived',
            disabledTooltip: "Click on the Archived tab above to continue",
            mode: "floating"
          },
          {
            id: 5,
            title: "You're Ready!",
            description: "You now know how to navigate between different project views. Each view is designed for different workflows and preferences.",
            content: <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                💡 Pro tip: Use Board view for quick status updates, List view for detailed analysis, and Archived view to review completed work!
              </p>
            </div>,
            canProceed: true,
            mode: "modal"
          }
        ]}
        onComplete={async () => {
          try {
            await completeStep();
            setShowTutorial(false);
            navigate('/getting-started');
          } catch (error) {
            console.error('Error completing tutorial:', error);
            setShowTutorial(false);
          }
        }}
        onExit={() => {
          setShowTutorial(false);
          navigate('/getting-started');
        }}
      />
    </div>
  );
};

export default AllProjects;