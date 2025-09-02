import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Calendar, CheckSquare, User, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { formatDate } from "@/lib/utils";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { KanbanLoadingSkeleton } from "@/components/ui/loading-presets";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";

interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
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
  upcoming_session_count?: number;
  planned_session_count?: number;
  next_session_date?: string | null;
  todo_count?: number;
  completed_todo_count?: number;
  services?: Array<{
    id: string;
    name: string;
  }>;
  assignees?: string[];
}

interface ProjectKanbanBoardProps {
  projects: Project[];
  projectStatuses?: ProjectStatus[];
  onProjectsChange: () => void;
  onProjectUpdate?: (project: Project) => void;
  onQuickView?: (project: Project) => void;
}

const ProjectKanbanBoard = ({ projects, projectStatuses, onProjectsChange, onProjectUpdate, onQuickView }: ProjectKanbanBoardProps) => {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  
  const { triggerNewAssignment, triggerProjectMilestone } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();

  useEffect(() => {
    if (projectStatuses && projectStatuses.length > 0) {
      // Use passed statuses if available
      setStatuses(projectStatuses.filter(s => s.name?.toLowerCase?.() !== 'archived'));
      setLoading(false);
    } else {
      fetchStatuses();
    }
  }, [projectStatuses]);

  const fetchStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStatuses((data || []).filter(s => s.name?.toLowerCase?.() !== 'archived'));
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

      // Notify parent about project update for tutorial tracking
      if (onProjectUpdate && project) {
        const updatedProject = { ...project, status_id: newStatusId };
        onProjectUpdate(updatedProject);
      }

      onProjectsChange();
      
      // Send milestone notifications for status change
      if (activeOrganization?.id) {
        const oldStatus = project?.status_id;
        if (oldStatus && oldStatus !== newStatusId) {
          await triggerProjectMilestone(projectId, oldStatus, newStatusId, activeOrganization.id, project?.assignees || []);
        }
      }
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
    if (onQuickView) {
      onQuickView(project);
    } else {
      setViewingProject(project);
      setShowViewDialog(true);
    }
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
            className="cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out bg-card border border-border/50 hover:border-border group"
            onClick={() => handleProjectClick(project)}
          >
            <CardContent className="p-4 space-y-3">
              {/* Project Type - Top Left Corner */}
              {project.project_type && (
                <div className="flex pt-1">
                  <Badge variant="secondary" className="text-xs font-medium bg-muted text-muted-foreground border-0 px-2 py-1">
                    {project.project_type.name}
                  </Badge>
                </div>
              )}

              {/* Main Content */}
              <div className="space-y-2">
                {/* Project Name - Bold, Larger Text */}
                <h3 className="font-bold text-base text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                
                {/* Lead Name - Smaller, with user icon */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{project.lead?.name || 'No Lead'}</span>
                </div>
              </div>

              {/* Optional To-Do Progress Bar */}
              {(project.todo_count || 0) > 0 && (
                <div className="space-y-2">
                  <ProgressBar
                    value={Math.round(((project.completed_todo_count || 0) / (project.todo_count || 0)) * 100)}
                    total={project.todo_count || 0}
                    completed={project.completed_todo_count || 0}
                    className="w-full"
                    showLabel={false}
                    size="sm"
                  />
                </div>
              )}

              {/* Separator Line */}
              <div className="border-t border-border/30" />

              {/* Footer with stats and assignees */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {/* Session Count - Always show icon */}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{project.session_count || project.planned_session_count || 0}</span>
                  </div>
                  
                  {/* Service Count - Always show icon */}
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{project.services?.length || 0}</span>
                  </div>
                </div>

                {/* Avatar Stack */}
                {project.assignees && project.assignees.length > 0 && (
                  <AssigneeAvatars 
                    assigneeIds={project.assignees} 
                    maxVisible={3}
                    size="sm"
                  />
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
      <div key={statusId} className="flex-shrink-0 w-80 bg-muted/30 rounded-lg flex flex-col">
        {/* Column header - Fixed */}
        <div className="p-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
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
            </button>
            <Badge variant="secondary" className="text-xs">
              {projects.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleAddProject(status?.id || null)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Droppable area without individual scrolling */}
        <div className="flex-1 px-4 pb-4">
          <Droppable droppableId={statusId}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-full transition-colors pb-2 ${
                  snapshot.isDraggingOver ? 'bg-accent/20' : ''
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
        </div>
      </div>
    );
  };

  if (loading) {
    return <KanbanLoadingSkeleton />;
  }

  return (
    <>
      {/* Kanban board horizontal scroll container */}
      <div 
        className="h-full w-full max-w-full overflow-x-auto overflow-y-hidden" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          touchAction: 'pan-x pan-y'
        }}
      >
        <div className="p-4 sm:p-6 h-full">
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Board lanes - intrinsic width forces overflow */}
            <div 
              className="flex gap-4 sm:gap-6 pb-4 h-full" 
              style={{ 
                width: 'max-content',
                minWidth: '100%'
              }}
            >
            {/* Render columns for each status */}
            {statuses.map(status => 
              renderColumn(status, getProjectsByStatus(status.id))
            )}
            
            {/* Column for projects without status */}
            {getProjectsWithoutStatus().length > 0 && renderColumn(null, getProjectsWithoutStatus())}
            </div>
          </DragDropContext>
        </div>
      </div>

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
    </>
  );
};

export default ProjectKanbanBoard;