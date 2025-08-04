import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Plus, FolderOpen, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProjectDialogWithLeadSelector } from "@/components/ProjectDialogWithLeadSelector";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { useNavigate } from "react-router-dom";
import { formatDate } from "@/lib/utils";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  lead: {
    id: string;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  session_count?: number;
  completed_session_count?: number;
  todo_count?: number;
  completed_todo_count?: number;
  services?: Array<{
    id: string;
    name: string;
  }>;
}

type SortField = 'name' | 'lead_name' | 'lead_status' | 'created_at' | 'updated_at' | 'session_count';
type SortDirection = 'asc' | 'desc';

const AllProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      // First get all projects
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
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
          // Get session counts
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id, status')
            .eq('project_id', project.id);

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
    
    // Apply status filter based on lead status
    if (statusFilter !== "all") {
      filtered = projects.filter(project => project.lead?.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'lead_name':
          aValue = a.lead?.name?.toLowerCase() || '';
          bValue = b.lead?.name?.toLowerCase() || '';
          break;
        case 'lead_status':
          aValue = a.lead?.status || '';
          bValue = b.lead?.status || '';
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
  }, [projects, statusFilter, sortField, sortDirection]);

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

  const statusOptions = [
    { value: "all", label: "All Lead Statuses" },
    { value: "new", label: "New" },
    { value: "contacted", label: "Contacted" },
    { value: "qualified", label: "Qualified" },
    { value: "proposal_sent", label: "Proposal Sent" },
    { value: "booked", label: "Booked" },
    { value: "completed", label: "Completed" },
    { value: "lost", label: "Lost" }
  ];

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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <p className="text-muted-foreground">Manage all your projects in one place</p>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Project
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filter by lead status:</span>
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
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('lead_status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon('lead_status')}
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
                      <span className="hover:underline cursor-pointer">
                        {project.name}
                      </span>
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
                      {project.lead ? (
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getLeadStatusStyles(project.lead.status).className}`}>
                          {formatStatusText(project.lead.status)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {statusFilter === "all" 
                      ? "No projects found. Create your first project to get started!"
                      : `No projects found for leads with status "${statusFilter}".`
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Project Dialog */}
      <ProjectDialogWithLeadSelector
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onProjectCreated={() => {
          fetchProjects();
          setShowAddDialog(false);
        }}
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
    </div>
  );
};

export default AllProjects;