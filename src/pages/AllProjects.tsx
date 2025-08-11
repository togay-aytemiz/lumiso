import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Plus, FolderOpen, User, LayoutGrid, List } from "lucide-react";
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
  }>;
}

type SortField = 'name' | 'lead_name' | 'created_at' | 'updated_at' | 'session_count' | 'project_type';
type SortDirection = 'asc' | 'desc';

const AllProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  
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
        { data: statusesData, error: statusesError }
      ] = await Promise.all([
        supabase
          .from('projects')
          .select(`
            *, 
            project_statuses(id, name, color),
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
              name
            )
           `)
        ,
        
        supabase
          .from('project_statuses')
          .select('*')
          .order('sort_order', { ascending: true })
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

      // Process all projects with their statistics
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
        };
      });

      setProjects(projectsWithStats);
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-muted-foreground">Manage all your projects in one place</p>
            </div>
            <div className="flex items-center gap-4 min-w-0 flex-1 justify-end">
              <EnhancedProjectDialog
                onProjectCreated={() => {
                  fetchProjects();
                }}
              >
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Project
                </Button>
              </EnhancedProjectDialog>
              <div className="w-full sm:max-w-lg min-w-0 flex-1">
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
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-2">
                          Project Name
                          {getSortIcon('name')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('lead_name')}
                      >
                        <div className="flex items-center gap-2">
                          Lead
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedProjects.length > 0 ? (
                      filteredAndSortedProjects.map((project) => (
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