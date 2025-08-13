import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Plus, FolderOpen, User, LayoutGrid, List, Archive } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useNavigate } from "react-router-dom";
import { formatDate } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";

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
  lead: {
    id: string;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  project_type?: {
    id: string;
    name: string;
  } | null;
  base_price?: number | null;
  session_count?: number;
  completed_session_count?: number;
  upcoming_session_count?: number;
  planned_session_count?: number;
  next_session_date?: string | null;
  todo_count?: number;
  completed_todo_count?: number;
  services?: Array<{
    id: string;
    name: string;
    price?: number | null;
    selling_price?: number | null;
  }>;
  total_paid?: number;
  remaining_amount?: number;
}

type SortField = 'name' | 'lead_name' | 'created_at' | 'updated_at' | 'session_count' | 'project_type';
type SortDirection = 'asc' | 'desc';

const AllProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'archived'>('board');
  
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel to avoid sequential loading
      const [
        { data: projectsData, error: projectsError },
        { data: leadsData, error: leadsError },
        { data: sessionsData, error: sessionsError },
        { data: todosData, error: todosError },
        { data: servicesData, error: servicesError },
        { data: statusesData, error: statusesError },
        { data: paymentsData, error: paymentsError }
      ] = await Promise.all([
        supabase
          .from('projects')
          .select(`
            *, 
            project_statuses:project_statuses!projects_status_id_fkey(id, name, color),
            project_types(id, name)
          `)
          .order('updated_at', { ascending: false }),
        
        supabase
          .from('leads')
          .select('id, name, status, email, phone'),
        
        supabase
          .from('sessions')
          .select('id, status, session_date, session_time, project_id'),
        
        supabase
          .from('todos')
          .select('id, is_completed, project_id'),
        
        supabase
          .from('project_services')
          .select(`
            project_id,
            services (
              id,
              name,
              price,
              selling_price
            )
           `),
        
        supabase
          .from('project_statuses')
          .select('*')
          .order('sort_order', { ascending: true }),
        
        supabase
          .from('payments')
          .select('project_id, amount, status, type')
      ]);

      if (projectsError) throw projectsError;
      if (leadsError) throw leadsError;
      if (sessionsError) throw sessionsError;
      if (todosError) throw todosError;
      if (servicesError) throw servicesError;
      if (statusesError) throw statusesError;

      // Set project statuses for use in components
      setProjectStatuses(statusesData || []);

      // Exclude archived projects by default
      const filteredProjectsData = (projectsData || []).filter((p: any) => {
        const statusName = p?.project_statuses?.name?.toLowerCase?.();
        return statusName !== 'archived';
      });

      // Create lookup maps for efficient data joining
      const leadsMap = new Map(leadsData?.map(lead => [lead.id, lead]) || []);
      const sessionsMap = new Map<string, any[]>();
      const todosMap = new Map<string, any[]>();
      const servicesMap = new Map<string, any[]>();
      const paymentsMap = new Map<string, { paid: number; due: number }>();

      // Group sessions by project_id
      sessionsData?.forEach(session => {
        if (!sessionsMap.has(session.project_id)) {
          sessionsMap.set(session.project_id, []);
        }
        sessionsMap.get(session.project_id)!.push(session);
      });

      // Group todos by project_id
      todosData?.forEach(todo => {
        if (!todosMap.has(todo.project_id)) {
          todosMap.set(todo.project_id, []);
        }
        todosMap.get(todo.project_id)!.push(todo);
      });

      // Group services by project_id
      servicesData?.forEach(projectService => {
        if (!servicesMap.has(projectService.project_id)) {
          servicesMap.set(projectService.project_id, []);
        }
        if (projectService.services) {
          servicesMap.get(projectService.project_id)!.push(projectService.services);
        }
      });

      // Aggregate payments by project_id
      paymentsData?.forEach((p: any) => {
        const prev = paymentsMap.get(p.project_id) || { paid: 0, due: 0 };
        if (p.status === 'paid') prev.paid += Number(p.amount) || 0;
        if (p.status === 'due') prev.due += Number(p.amount) || 0;
        paymentsMap.set(p.project_id, prev);
      });

      // Process all active projects with their statistics
      const projectsWithStats = filteredProjectsData.map((project: any) => {
        const sessions = sessionsMap.get(project.id) || [];
        const todos = todosMap.get(project.id) || [];
        const services = servicesMap.get(project.id) || [];

        // Calculate upcoming sessions (future sessions)
        const now = new Date();
        const upcomingSessions = sessions.filter(session => {
          const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
          return sessionDateTime > now && session.status !== 'completed';
        });

        // Payment and remaining calculations
        const base = Number(project.base_price || 0);
        const servicesCost = services.reduce((sum: number, s: any) => sum + Number(s?.selling_price ?? s?.price ?? 0), 0);
        const totalPaid = paymentsMap.get(project.id)?.paid || 0;
        const remainingAmount = Math.max(0, base + servicesCost - totalPaid);

        return {
          ...project,
          lead: leadsMap.get(project.lead_id) || null,
          project_type: project.project_types || null,
          session_count: sessions.length,
          completed_session_count: sessions.filter(s => s.status === 'completed').length,
          upcoming_session_count: upcomingSessions.length,
          planned_session_count: sessions.filter(s => s.status === 'planned').length,
          next_session_date: upcomingSessions.length > 0 ? upcomingSessions[0].session_date : null,
          todo_count: todos.length,
          completed_todo_count: todos.filter(t => t.is_completed).length,
          services: services,
          total_paid: totalPaid,
          remaining_amount: remainingAmount,
        };
      });

      // Archived projects only
      const archivedOnly = (projectsData || []).filter((p: any) => {
        const statusName = p?.project_statuses?.name?.toLowerCase?.();
        return statusName === 'archived';
      });

      const archivedWithStats = archivedOnly.map((project: any) => {
        const sessions = sessionsMap.get(project.id) || [];
        const todos = todosMap.get(project.id) || [];
        const services = servicesMap.get(project.id) || [];

        const now = new Date();
        const upcomingSessions = sessions.filter(session => {
          const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
          return sessionDateTime > now && session.status !== 'completed';
        });

        // Payment and remaining calculations
        const base = Number(project.base_price || 0);
        const servicesCost = services.reduce((sum: number, s: any) => sum + Number(s?.selling_price ?? s?.price ?? 0), 0);
        const totalPaid = paymentsMap.get(project.id)?.paid || 0;
        const remainingAmount = Math.max(0, base + servicesCost - totalPaid);

        return {
          ...project,
          lead: leadsMap.get(project.lead_id) || null,
          project_type: project.project_types || null,
          session_count: sessions.length,
          completed_session_count: sessions.filter(s => s.status === 'completed').length,
          upcoming_session_count: upcomingSessions.length,
          planned_session_count: sessions.filter(s => s.status === 'planned').length,
          next_session_date: upcomingSessions.length > 0 ? upcomingSessions[0].session_date : null,
          todo_count: todos.length,
          completed_todo_count: todos.filter(t => t.is_completed).length,
          services: services,
          total_paid: totalPaid,
          remaining_amount: remainingAmount,
        };
      });

      setProjects(projectsWithStats);
      setArchivedProjects(archivedWithStats);
    } catch (error: any) {
      toast({
        title: "Error fetching projects",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;
    
    // No filtering needed since we removed lead status filter

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'lead_name':
          aValue = a.lead?.name?.toLowerCase() || '';
          bValue = b.lead?.name?.toLowerCase() || '';
          break;
        case 'project_type':
          aValue = a.project_type?.name?.toLowerCase() || '';
          bValue = b.project_type?.name?.toLowerCase() || '';
          break;
        case 'session_count':
          aValue = a.session_count || 0;
          bValue = b.session_count || 0;
          break;
        case 'created_at':
        case 'updated_at':
          aValue = new Date(a[sortField]).getTime();
          bValue = new Date(b[sortField]).getTime();
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      // Handle string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [projects, sortField, sortDirection]);

  const archivedFilteredAndSortedProjects = useMemo(() => {
    let filtered = archivedProjects;

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'lead_name':
          aValue = a.lead?.name?.toLowerCase() || '';
          bValue = b.lead?.name?.toLowerCase() || '';
          break;
        case 'project_type':
          aValue = a.project_type?.name?.toLowerCase() || '';
          bValue = b.project_type?.name?.toLowerCase() || '';
          break;
        case 'session_count':
          aValue = a.session_count || 0;
          bValue = b.session_count || 0;
          break;
        case 'created_at':
        case 'updated_at':
          aValue = new Date(a[sortField]).getTime();
          bValue = new Date(b[sortField]).getTime();
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [archivedProjects, sortField, sortDirection]);

  const displayedProjects = viewMode === 'archived' ? archivedFilteredAndSortedProjects : filteredAndSortedProjects;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleProjectClick = (project: Project) => {
    setViewingProject(project);
    setShowViewDialog(true);
  };

  const handleLeadClick = (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation(); // Prevent project dialog from opening
    navigate(`/leads/${leadId}`, { state: { from: 'all-projects' } });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // Removed unused statusOptions since we no longer filter by lead status

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

  const formatCurrency = (amount?: number) => {
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
      {/* Fixed header section */}
      <div className="flex-none p-8 pb-0">
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold">Projects</h1>
                <p className="text-muted-foreground">Manage all your projects in one place</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <EnhancedProjectDialog
                onProjectCreated={() => {
                  fetchProjects();
                }}
              >
                <Button className="flex items-center gap-2 justify-center sm:w-auto w-fit self-start">
                  <Plus className="h-4 w-4" />
                  Add Project
                </Button>
              </EnhancedProjectDialog>
              <div className="flex-1 max-w-md">
                <GlobalSearch />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle - Fixed */}
      <div className="flex-none px-8">
        <div className="border-b border-border w-full">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none border-b-2 transition-colors ${
                viewMode === 'board' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Board View
            </Button>
            <Button
              variant="ghost"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none border-b-2 transition-colors ${
                viewMode === 'list' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
              List View
            </Button>
            <Button
              variant="ghost"
              onClick={() => setViewMode('archived')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none border-b-2 transition-colors ${
                viewMode === 'archived' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </div>
        </div>
      </div>

      {/* Content area - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {viewMode === 'board' ? (
          <div className="h-full">
            <ProjectKanbanBoard 
              projects={projects} 
              onProjectsChange={fetchProjects}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-8 pt-6">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {viewMode === 'archived' ? (
                        <>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-2">
                              Project
                              {getSortIcon('name')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('lead_name')}
                          >
                            <div className="flex items-center gap-2">
                              Client
                              {getSortIcon('lead_name')}
                            </div>
                          </TableHead>
                          <TableHead>
                            Type
                          </TableHead>
                          <TableHead>
                            Paid
                          </TableHead>
                          <TableHead>
                            Remaining
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('updated_at')}
                          >
                            <div className="flex items-center gap-2">
                              Last Updated
                              {getSortIcon('updated_at')}
                            </div>
                          </TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('name')}
                          >
                    <div className="flex items-center gap-2">
                      Project
                      {getSortIcon('name')}
                    </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('lead_name')}
                          >
                            <div className="flex items-center gap-2">
                              Client
                              {getSortIcon('lead_name')}
                            </div>
                          </TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('project_type')}
                          >
                            <div className="flex items-center gap-2">
                              Type
                              {getSortIcon('project_type')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-center"
                            onClick={() => handleSort('session_count')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Sessions
                              {getSortIcon('session_count')}
                            </div>
                          </TableHead>
                          <TableHead className="text-center">Todos</TableHead>
                          <TableHead>Services</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('updated_at')}
                          >
                            <div className="flex items-center gap-2">
                              Last Updated
                              {getSortIcon('updated_at')}
                            </div>
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedProjects.length > 0 ? (
                      displayedProjects.map((project) => (
                        <TableRow 
                          key={project.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleProjectClick(project)}
                        >
                          <TableCell className="font-medium">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-left justify-start font-medium text-foreground hover:text-foreground hover:underline"
                              onClick={() => handleProjectClick(project)}
                            >
                              {project.name}
                            </Button>
                          </TableCell>
                          <TableCell>
                            {project.lead ? (
                              <>
                                <Button
                                  variant="link"
                                  className="p-0 h-auto text-left justify-start text-foreground hover:text-foreground hover:underline"
                                  onClick={(e) => handleLeadClick(e, project.lead.id)}
                                >
                                  {project.lead.name}
                                </Button>
                                {project.lead.email && (
                                  <div className="text-xs text-muted-foreground">{project.lead.email}</div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Lead not found</span>
                            )}
                          </TableCell>
                          {viewMode === 'archived' ? (
                            <>
                              <TableCell>
                                {project.project_type ? (
                                  <Badge variant="outline" className="text-xs">
                                    {project.project_type.name.toUpperCase()}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm font-medium text-green-600">
                                {formatCurrency(project.total_paid || 0)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatCurrency(project.remaining_amount || 0)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(project.updated_at)}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>
                                <ProjectStatusBadge 
                                  projectId={project.id}
                                  currentStatusId={project.status_id}
                                  editable={false}
                                  size="sm"
                                  statuses={projectStatuses}
                                  onStatusChange={() => fetchProjects()}
                                />
                              </TableCell>
                              <TableCell>
                                {project.project_type ? (
                                  <Badge variant="outline" className="text-xs">
                                    {project.project_type.name.toUpperCase()}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {getProgressBadge(project.completed_session_count || 0, project.session_count || 0)}
                              </TableCell>
                              <TableCell className="text-center">
                                {getProgressBadge(project.completed_todo_count || 0, project.todo_count || 0)}
                              </TableCell>
                              <TableCell>
                                {renderServicesChips(project.services || [])}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(project.updated_at)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No projects found. Create your first project to get started!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
    </div>
  );
};

export default AllProjects;