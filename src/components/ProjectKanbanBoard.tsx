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
import { ProfessionalKanbanCard } from "@/components/ProfessionalKanbanCard";
import { KanbanLoadingSkeleton } from "@/components/ui/loading-presets";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useKanbanSettings } from "@/hooks/useKanbanSettings";
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
const ProjectKanbanBoard = ({
  projects,
  projectStatuses,
  onProjectsChange,
  onProjectUpdate,
  onQuickView
}: ProjectKanbanBoardProps) => {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const {
    triggerNewAssignment,
    triggerProjectMilestone
  } = useNotificationTriggers();
  const {
    activeOrganization
  } = useOrganization();
  const { settings: kanbanSettings } = useKanbanSettings();
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const {
        data: organizationId
      } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;
      const {
        data,
        error
      } = await supabase.from('project_statuses').select('*').eq('organization_id', organizationId).order('sort_order', {
        ascending: true
      });
      if (error) throw error;
      setStatuses((data || []).filter(s => s.name?.toLowerCase?.() !== 'archived'));
    } catch (error) {
      console.error('Error fetching project statuses:', error);
      toast({
        title: "Error",
        description: "Failed to load project statuses",
        variant: "destructive"
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
    const {
      destination,
      source,
      draggableId
    } = result;
    if (!destination) return;
    
    // If dropped in the same position, do nothing
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    const projectId = draggableId;
    const newStatusId = destination.droppableId === 'no-status' ? null : destination.droppableId;
    
    // Handle reordering within the same column
    if (destination.droppableId === source.droppableId) {
      // For now, we'll just update the UI optimistically since we don't have sort_order column
      // The projects will maintain their database order but appear reordered in the UI
      onProjectsChange();
      return;
    }
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find the project and old status
      const project = projects.find(p => p.id === projectId);
      const oldStatus = statuses.find(s => s.id === project?.status_id);
      const newStatus = statuses.find(s => s.id === newStatusId);

      // Update project status
      const {
        error
      } = await supabase.from('projects').update({
        status_id: newStatusId
      }).eq('id', projectId).eq('user_id', user.id);
      if (error) throw error;

      // Log the status change
      const statusChangeMessage = `Status changed from '${oldStatus?.name || 'No Status'}' to '${newStatus?.name || 'No Status'}'`;
      await supabase.from('activities').insert({
        type: 'status_change',
        content: statusChangeMessage,
        project_id: projectId,
        lead_id: project?.lead_id,
        user_id: user.id
      });
      toast({
        title: "Project Updated",
        description: `Project moved to ${newStatus?.name || 'No Status'}`
      });

      // Notify parent about project update for tutorial tracking
      if (onProjectUpdate && project) {
        const updatedProject = {
          ...project,
          status_id: newStatusId
        };
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
        variant: "destructive"
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
  const renderProjectCard = (project: Project, index: number) => <Draggable key={project.id} draggableId={project.id} index={index}>
      {provided => <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="mb-3 md:mb-2">
          <ProfessionalKanbanCard
            project={project}
            kanbanSettings={kanbanSettings}
            onClick={() => handleProjectClick(project)}
          />
        </div>}
    </Draggable>;
  const renderColumn = (status: ProjectStatus | null, projects: Project[]) => {
    const statusId = status?.id || 'no-status';
    const statusName = status?.name || 'No Status';
    const statusColor = status?.color || '#6B7280';
    return <div key={statusId} className="flex-shrink-0 w-80 bg-muted/30 rounded-lg flex flex-col">
        {/* Column header - Fixed */}
        <div className="p-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80" style={{
            backgroundColor: statusColor + '20',
            color: statusColor,
            border: `1px solid ${statusColor}40`
          }}>
              <div className="w-2 h-2 rounded-full" style={{
              backgroundColor: statusColor
            }} />
              <span className="uppercase tracking-wide font-semibold">{statusName}</span>
            </button>
            <Badge variant="secondary" className="text-xs">
              {projects.length}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={() => handleAddProject(status?.id || null)} className="h-6 w-6 text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Droppable area without vertical scrolling constraints */}
        <div className="flex-1 px-4 pb-4 min-h-0">
          <Droppable droppableId={statusId}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`transition-colors pb-2 ${snapshot.isDraggingOver ? 'bg-accent/20' : ''}`}
              >
                {/* Project cards */}
                {projects.map((project, index) => renderProjectCard(project, index))}
                
                {/* Add project button */}
                {projects.length === 0 ? <div className="flex items-center justify-center h-32">
                    <Button variant="outline" onClick={() => handleAddProject(status?.id || null)} className="flex items-center gap-2 border-dashed">
                      <Plus className="h-4 w-4" />
                      Add Project
                    </Button>
                  </div> : <Button variant="outline" onClick={() => handleAddProject(status?.id || null)} className="w-full flex items-center gap-2 border-dashed mt-2">
                    <Plus className="h-4 w-4" />
                    Add Project
                  </Button>}
                
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>;
  };
  if (loading) {
    return <KanbanLoadingSkeleton />;
  }
  return <>
      {/* Kanban board container with natural height flow */}
      <div className="h-full w-full max-w-full overflow-x-auto" style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        touchAction: 'pan-x pan-y'
      }}>
        <div className="p-4 sm:p-6 h-full">
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Board lanes - intrinsic width forces overflow */}
            <div className="flex gap-2 sm:gap-3 pb-4 h-full" style={{
            width: 'max-content',
            minWidth: '100%'
          }}>
            {/* Render columns for each status */}
            {statuses.map(status => renderColumn(status, getProjectsByStatus(status.id)))}
            
            {/* Column for projects without status */}
            {getProjectsWithoutStatus().length > 0 && renderColumn(null, getProjectsWithoutStatus())}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* Add Project Dialog */}
      <EnhancedProjectDialog defaultStatusId={selectedStatusId} onProjectCreated={() => {
      onProjectsChange();
      setSelectedStatusId(null);
    }}>
        <Button id="kanban-add-project-trigger" className="hidden">
          Add Project
        </Button>
      </EnhancedProjectDialog>

      {/* View Project Dialog */}
      <ViewProjectDialog project={viewingProject} open={showViewDialog} onOpenChange={setShowViewDialog} onProjectUpdated={onProjectsChange} onActivityUpdated={() => {}} leadName={viewingProject?.lead?.name || ""} />
    </>;
};
export default ProjectKanbanBoard;