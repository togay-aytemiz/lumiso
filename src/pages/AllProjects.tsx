import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  lead: {
    id: string;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  session_count?: number;
  completed_session_count?: number;
  upcoming_session_count?: number;
  next_session_date?: string | null;
  todo_count?: number;
  completed_todo_count?: number;
  services?: Array<{
    id: string;
    name: string;
  }>;
}

type SortField = 'name' | 'lead_name' | 'created_at' | 'updated_at' | 'session_count';
type SortDirection = 'asc' | 'desc';

const AllProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
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
      // First get all projects with their status
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*, project_statuses(id, name, color)')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Then get all leads info
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, name, status, email, phone');

      // Create a map of leads for quick lookup
      const leadsMap = new Map(leadsData?.map(lead => [lead.id, lead]) || []);

      // Fetch additional project statistics
      const projectsWithStats = await Promise.all(
        (projectsData || []).map(async (project) => {
          // Get session counts and upcoming sessions
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id, status, session_date, session_time')
            .eq('project_id', project.id);

          // Calculate upcoming sessions (future sessions)
          const now = new Date();
          const upcomingSessions = sessions?.filter(session => {
            const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
            return sessionDateTime > now && session.status !== 'completed';
          }) || [];

          // Get todo counts
          const { data: todos } = await supabase
            .from('todos')
            .select('id, is_completed')
            .eq('project_id', project.id);

          // Get services for this project
          const { data: projectServices } = await supabase
            .from('project_services')
            .select(`
              services (
                id,
                name
              )
            `)
            .eq('project_id', project.id);

          const services = projectServices?.map(ps => ps.services).filter(Boolean) || [];

          return {
            ...project,
            lead: leadsMap.get(project.lead_id) || null,
            session_count: sessions?.length || 0,
            completed_session_count: sessions?.filter(s => s.status === 'completed').length || 0,
            upcoming_session_count: upcomingSessions.length,
            next_session_date: upcomingSessions.length > 0 ? upcomingSessions[0].session_date : null,
            todo_count: todos?.length || 0,
            completed_todo_count: todos?.filter(t => t.is_completed).length || 0,
            services: services,
          };
        })
      );

      setProjects(projectsWithStats);
    } catch (error: any) {
      toast({
        title: "Error fetching projects",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

  if (loading) {
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
      {/* Fixed header section */}
      <div className="flex-none p-8 pb-0">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-muted-foreground">Manage all your projects in one place</p>
            </div>
            <div className="w-full max-w-lg min-w-[480px] ml-8">
              <GlobalSearch />
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
                  ? 'border-primary text-primary bg-primary/5' 
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
                  ? 'border-primary text-primary bg-primary/5' 
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
      <div className="flex-1 overflow-hidden">
        {viewMode === 'board' ? (
          <div className="h-full p-8 pt-6">
            <ProjectKanbanBoard 
              projects={projects} 
              onProjectsChange={fetchProjects}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-8 pt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
                  </div>
                </div>
              </CardHeader>
            
              <CardContent>
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
                      <TableHead>Status</TableHead>
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
                              className="p-0 h-auto text-left justify-start font-medium"
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
                                  className="p-0 h-auto text-left justify-start"
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
                              onStatusChange={() => fetchProjects()}
                            />
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
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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