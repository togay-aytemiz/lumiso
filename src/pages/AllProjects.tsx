import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, LayoutGrid, List, Archive, Calendar, CheckSquare, User, Eye, MessageSquare, CheckCircle2, Phone, Mail, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import GlobalSearch from "@/components/GlobalSearch";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { formatDate } from "@/lib/utils";

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
  services?: Array<{
    id: string;
    name: string;
  }>;
}

const AllProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'archived'>('board');
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select(`
          *,
          lead:leads(id, name, status, email, phone),
          project_status:project_statuses(id, name, color),
          project_type:project_types(id, name),
          session_count:sessions(count),
          upcoming_session_count:sessions!inner(count),
          planned_session_count:sessions!inner(count),
          todo_count:todos(count),
          completed_todo_count:todos!inner(count),
          services:project_services(
            service:services(id, name)
          )
        `)
        .eq('user_id', user.id)
        .eq('upcoming_session_count.status', 'upcoming')
        .eq('planned_session_count.status', 'planned')
        .eq('completed_todo_count.completed', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process the data to handle archived projects
      const activeProjects = (projectsData || []).filter(project => project.status_id !== 'archived');
      const archived = (projectsData || []).filter(project => project.status_id === 'archived');

      setProjects(activeProjects.map(project => ({
        ...project,
        session_count: Array.isArray(project.session_count) ? project.session_count[0]?.count || 0 : 0,
        upcoming_session_count: Array.isArray(project.upcoming_session_count) ? project.upcoming_session_count[0]?.count || 0 : 0,
        planned_session_count: Array.isArray(project.planned_session_count) ? project.planned_session_count[0]?.count || 0 : 0,
        todo_count: Array.isArray(project.todo_count) ? project.todo_count[0]?.count || 0 : 0,
        completed_todo_count: Array.isArray(project.completed_todo_count) ? project.completed_todo_count[0]?.count || 0 : 0,
        services: Array.isArray(project.services) ? project.services.map(ps => ps.service).filter(Boolean) || [] : []
      })));

      setArchivedProjects(archived.map(project => ({
        ...project,
        session_count: Array.isArray(project.session_count) ? project.session_count[0]?.count || 0 : 0,
        upcoming_session_count: Array.isArray(project.upcoming_session_count) ? project.upcoming_session_count[0]?.count || 0 : 0,
        planned_session_count: Array.isArray(project.planned_session_count) ? project.planned_session_count[0]?.count || 0 : 0,
        todo_count: Array.isArray(project.todo_count) ? project.todo_count[0]?.count || 0 : 0,
        completed_todo_count: Array.isArray(project.completed_todo_count) ? project.completed_todo_count[0]?.count || 0 : 0,
        services: Array.isArray(project.services) ? project.services.map(ps => ps.service).filter(Boolean) || [] : []
      })));

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
    <div className="flex flex-col h-screen">
      {/* Header - constrain to viewport width */}
      <div className="flex-shrink-0 p-4 sm:p-6 pb-0">
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">Projects</h1>
                <p className="text-muted-foreground truncate">Manage all your projects in one place</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink min-w-0">
                <div className="w-full sm:w-auto sm:max-w-[200px] min-w-0">
                  <GlobalSearch />
                </div>
                <EnhancedProjectDialog
                  onProjectCreated={() => {
                    fetchProjects();
                  }}
                >
                  <Button className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                    <Plus className="h-4 w-4" />
                    Add Project
                  </Button>
                </EnhancedProjectDialog>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle - allow wrapping */}
      <div className="flex-shrink-0 px-4 sm:px-6 pb-2">
        <div className="border-b border-border">
          <div className="flex flex-wrap items-center gap-1 pb-2">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('board')}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <LayoutGrid className="h-4 w-4" />
              Board View
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <List className="h-4 w-4" />
              List View
            </Button>
            <Button
              variant={viewMode === 'archived' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('archived')}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Archive className="h-4 w-4" />
              Archived ({archivedProjects.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Content area - board manages its own scroll, lists get contained scroll */}
      <div className="flex-1 min-h-0">
        {viewMode === 'board' ? (
          <ProjectKanbanBoard 
            projects={projects} 
            onProjectsChange={fetchProjects}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4 sm:p-6">
            <Card className="w-full max-w-full">
              <CardContent className="pt-6 p-0 w-full max-w-full">
                {/* Table wrapper with horizontal scroll - headers stay outside */}
                <div 
                  className="overflow-x-auto overflow-y-hidden w-full" 
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin' 
                  }}
                >
                  <div className="min-w-[1000px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Lead Name</TableHead>
                          <TableHead className="w-[250px]">Project</TableHead>
                          <TableHead className="w-[120px]">Type</TableHead>
                          <TableHead className="w-[120px]">Status</TableHead>
                          <TableHead className="w-[100px]">Sessions</TableHead>
                          <TableHead className="w-[100px]">Progress</TableHead>
                          <TableHead className="w-[150px]">Services</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(viewMode === 'archived' ? archivedProjects : projects).length > 0 ? (
                          (viewMode === 'archived' ? archivedProjects : projects).map((project) => (
                            <TableRow key={project.id} className="hover:bg-muted/50">
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">
                                    {project.lead?.name || 'No Lead'}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {project.lead?.email && (
                                      <div className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        <span className="truncate max-w-[100px]">{project.lead.email}</span>
                                      </div>
                                    )}
                                    {project.lead?.phone && (
                                      <div className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        <span>{project.lead.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-sm line-clamp-2">
                                    {project.name}
                                  </div>
                                  {project.description && (
                                    <div className="text-xs text-muted-foreground line-clamp-1">
                                      {project.description}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {project.project_type ? (
                                  <Badge variant="outline" className="text-xs">
                                    {project.project_type.name}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {project.project_status ? (
                                  <Badge variant="outline" className="text-xs">
                                    {project.project_status.name}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1 text-xs">
                                    <Calendar className="h-3 w-3" />
                                    <span>{project.upcoming_session_count || 0} upcoming</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{project.planned_session_count || 0} planned</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CheckSquare className="h-3 w-3 text-muted-foreground" />
                                  {getProgressBadge(project.completed_todo_count || 0, project.todo_count || 0)}
                                </div>
                              </TableCell>
                              <TableCell>
                                {renderServicesChips(project.services || [])}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleProjectClick(project)}
                                  className="flex items-center gap-1 text-xs"
                                >
                                  <Eye className="h-3 w-3" />
                                  View
                                </Button>
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
    </div>
  );
};

export default AllProjects;