import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Calendar, CheckSquare, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { formatDate } from "@/lib/utils";

interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  created_at: string;
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
  lead: {
    id: string;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  session_count?: number;
  upcoming_session_count?: number;
  next_session_date?: string | null;
  todo_count?: number;
  completed_todo_count?: number;
  services?: Array<{
    id: string;
    name: string;
  }>;
}

interface ProjectKanbanBoardProps {
  projects: Project[];
  onProjectsChange: () => void;
}

const ProjectKanbanBoard = ({ projects, onProjectsChange }: ProjectKanbanBoardProps) => {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching project statuses:', error);
      toast({
        title: "Error",
        description: "Failed to load project statuses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getProjectsByStatus = (statusId: string) => {
    return projects.filter(project => project.status_id === statusId);
  };

  const getProjectsWithoutStatus = () => {
    return projects.filter(project => !project.status_id);
  };

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const projectId = draggableId;
    const newStatusId = destination.droppableId === 'no-status' ? null : destination.droppableId;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find the project and old status
      const project = projects.find(p => p.id === projectId);
      const oldStatus = statuses.find(s => s.id === project?.status_id);
      const newStatus = statuses.find(s => s.id === newStatusId);

      // Update project status
      const { error } = await supabase
        .from('projects')
        .update({ status_id: newStatusId })
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Log the status change
      const statusChangeMessage = `Status changed from '${oldStatus?.name || 'No Status'}' to '${newStatus?.name || 'No Status'}'`;
      
      await supabase
        .from('activities')
        .insert({
          type: 'status_change',
          content: statusChangeMessage,
          project_id: projectId,
          lead_id: project?.lead_id,
          user_id: user.id,
        });

      toast({
        title: "Project Updated",
        description: `Project moved to ${newStatus?.name || 'No Status'}`,
      });

      onProjectsChange();
    } catch (error) {
      console.error('Error updating project status:', error);
      toast({
        title: "Error",
        description: "Failed to update project status",
        variant: "destructive",
      });
    }
  };

  const handleAddProject = (statusId: string | null) => {
    setSelectedStatusId(statusId);
    // Trigger the hidden dialog button
    const triggerButton = document.getElementById('kanban-add-project-trigger');
    if (triggerButton) {
      triggerButton.click();
    }
  };

  const handleProjectClick = (project: Project) => {
    setViewingProject(project);
    setShowViewDialog(true);
  };

  const renderProjectCard = (project: Project, index: number) => (
    <Draggable key={project.id} draggableId={project.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-3"
        >
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow duration-200 bg-card border border-border"
            onClick={() => handleProjectClick(project)}
          >
            <CardContent className="p-4">
              {/* Lead name (bold, top) */}
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold text-sm">{project.lead?.name || 'No Lead'}</span>
              </div>
              
              {/* Project name (middle) */}
              <h4 className="font-medium text-base mb-3 line-clamp-2">{project.name}</h4>
              
              {/* Bottom section */}
              <div className="space-y-2">
                {/* Session info */}
                {(project.upcoming_session_count || 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{project.upcoming_session_count} upcoming session{project.upcoming_session_count !== 1 ? 's' : ''}</span>
                  </div>
                )}
                
                {/* Todo progress */}
                {(project.todo_count || 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-3 w-3 text-muted-foreground" />
                    <Badge 
                      variant="secondary" 
                      className="text-xs h-5 px-2"
                    >
                      {project.completed_todo_count || 0}/{project.todo_count || 0} todos complete
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );

  const renderColumn = (status: ProjectStatus | null, projects: Project[]) => {
    const statusId = status?.id || 'no-status';
    const statusName = status?.name || 'No Status';
    const statusColor = status?.color || '#6B7280';

    return (
      <div key={statusId} className="flex-shrink-0 w-80 bg-muted/30 rounded-lg flex flex-col h-full">
        {/* Column header - Fixed */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
            style={{ 
              backgroundColor: statusColor + '20',
              color: statusColor,
              border: `1px solid ${statusColor}40`
            }}
          >
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: statusColor }}
            />
            <span className="uppercase tracking-wide font-semibold">{statusName}</span>
            <Badge variant="secondary" className="text-xs ml-1">
              {projects.length}
            </Badge>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleAddProject(status?.id || null)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable droppable area */}
        <div className="flex-1 px-4 pb-4">
          <ScrollArea className="h-full">
            <Droppable droppableId={statusId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[200px] rounded-lg transition-colors pb-2 ${
                    snapshot.isDraggingOver ? 'bg-accent/50' : ''
                  }`}
                >
                  {/* Project cards */}
                  {projects.map((project, index) => renderProjectCard(project, index))}
                  
                  {/* Add project button */}
                  {projects.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <Button
                        variant="outline"
                        onClick={() => handleAddProject(status?.id || null)}
                        className="flex items-center gap-2 border-dashed"
                      >
                        <Plus className="h-4 w-4" />
                        Add Project
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleAddProject(status?.id || null)}
                      className="w-full flex items-center gap-2 border-dashed mt-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Project
                    </Button>
                  )}
                  
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </ScrollArea>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-6">
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Horizontally scrollable board area with fixed height */}
        <div className="overflow-x-auto h-full">
          <div className="flex gap-6 pb-4 min-w-fit h-full">
            {/* Render columns for each status */}
            {statuses.map(status => 
              renderColumn(status, getProjectsByStatus(status.id))
            )}
            
            {/* Column for projects without status */}
            {getProjectsWithoutStatus().length > 0 && renderColumn(null, getProjectsWithoutStatus())}
          </div>
        </div>
      </DragDropContext>

      {/* Add Project Dialog */}
      <EnhancedProjectDialog
        defaultStatusId={selectedStatusId}
        onProjectCreated={() => {
          onProjectsChange();
          setSelectedStatusId(null);
        }}
      >
        <Button 
          id="kanban-add-project-trigger"
          className="hidden"
        >
          Add Project
        </Button>
      </EnhancedProjectDialog>

      {/* View Project Dialog */}
      <ViewProjectDialog
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onProjectUpdated={onProjectsChange}
        onActivityUpdated={() => {}}
        leadName={viewingProject?.lead?.name || ""}
      />
    </div>
  );
};

export default ProjectKanbanBoard;