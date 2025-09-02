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
  sort_order?: number;
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

const GAP = 1000;

const orderProjects = (list: Project[]) => {
  return [...list].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ad - bd;
  });
};

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

  const { triggerNewAssignment, triggerProjectMilestone } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();
  const { settings: kanbanSettings } = useKanbanSettings();

  useEffect(() => {
    if (projectStatuses && projectStatuses.length > 0) {
      setStatuses(projectStatuses.filter(s => s.name?.toLowerCase?.() !== "archived"));
      setLoading(false);
    } else {
      fetchStatuses();
    }
  }, [projectStatuses]);

  const fetchStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: organizationId } = await supabase.rpc("get_user_active_organization_id");
      if (!organizationId) return;

      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setStatuses((data || []).filter(s => s.name?.toLowerCase?.() !== "archived"));
    } catch (error) {
      console.error("Error fetching project statuses:", error);
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
    return orderProjects(projects.filter(project => project.status_id === statusId));
  };

  const getProjectsWithoutStatus = () => {
    return orderProjects(projects.filter(project => !project.status_id));
  };

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const projectId = draggableId;
      const srcStatusId = source.droppableId === "no-status" ? null : source.droppableId;
      const dstStatusId = destination.droppableId === "no-status" ? null : destination.droppableId;

      const moving = projects.find(p => p.id === projectId);
      if (!moving) return;

      const oldStatus = statuses.find(s => s.id === moving.status_id);
      const newStatus = statuses.find(s => s.id === dstStatusId || "");

      const srcListBase = orderProjects(projects.filter(p => p.status_id === srcStatusId && p.id !== moving.id));
      let dstListBase = orderProjects(projects.filter(p => p.status_id === dstStatusId && p.id !== moving.id));

      if (srcStatusId === dstStatusId) {
        dstListBase = orderProjects(projects.filter(p => p.status_id === srcStatusId && p.id !== moving.id));
      }

      const itemWithNewStatus: Project = { ...moving, status_id: dstStatusId };
      const dstList = [...dstListBase];
      const insertIndex = Math.min(Math.max(destination.index, 0), dstList.length);
      dstList.splice(insertIndex, 0, itemWithNewStatus);

      // Calculate the new sort order based on the destination index
      const newSortOrder = (destination.index + 1) * GAP;

      // Update just the moved project with its new status and position
      const { error } = await supabase
        .from("projects")
        .update({
          status_id: dstStatusId,
          sort_order: newSortOrder
        })
        .eq("id", projectId);

      if (error) throw error;

      if (srcStatusId !== dstStatusId) {
        const statusChangeMessage = `Status changed from '${oldStatus?.name || "No Status"}' to '${newStatus?.name || "No Status"}'`;
        await supabase.from("activities").insert({
          type: "status_change",
          content: statusChangeMessage,
          project_id: projectId,
          lead_id: moving.lead_id,
          user_id: user.id
        });
        toast({
          title: "Project Updated",
          description: `Project moved to ${newStatus?.name || "No Status"}`
        });
      } else {
        toast({
          title: "Project Reordered",
          description: "Project position updated"
        });
      }

      onProjectsChange();
      if (onProjectUpdate) {
        onProjectUpdate({ ...moving, status_id: dstStatusId, sort_order: (insertIndex + 1) * GAP });
      }
    } catch (error) {
      console.error("Error updating project order:", error);
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive"
      });
    }
  };

  const handleAddProject = (statusId: string | null) => {
    setSelectedStatusId(statusId);
    const triggerButton = document.getElementById("kanban-add-project-trigger");
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
          className="mb-3 md:mb-2"
        >
          <ProfessionalKanbanCard
            project={project}
            kanbanSettings={kanbanSettings}
            onClick={() => handleProjectClick(project)}
          />
        </div>
      )}
    </Draggable>
  );

  const renderColumn = (status: ProjectStatus | null, columnProjects: Project[]) => {
    const statusId = status?.id || "no-status";
    const statusName = status?.name || "No Status";
    const statusColor = status?.color || "#6B7280";

    const ordered = orderProjects(columnProjects);

    return (
      <div key={statusId} className="flex-shrink-0 w-80 bg-muted/30 rounded-lg flex flex-col">
        <div className="p-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
              style={{
                backgroundColor: statusColor + "20",
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
              {ordered.length}
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

        <div className="flex-1 px-4 pb-4 min-h-0">
          <Droppable droppableId={statusId}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`transition-colors pb-2 ${snapshot.isDraggingOver ? "bg-accent/20" : ""}`}
              >
                {ordered.map((project, index) => renderProjectCard(project, index))}

                {ordered.length === 0 ? (
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
      <div
        className="h-full w-full max-w-full overflow-x-auto"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
          touchAction: "pan-x pan-y"
        }}
      >
        <div className="p-4 sm:p-6 h-full">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div
              className="flex gap-2 sm:gap-3 pb-4 h-full"
              style={{ width: "max-content", minWidth: "100%" }}
            >
              {statuses.map(status => renderColumn(status, getProjectsByStatus(status.id)))}
              {getProjectsWithoutStatus().length > 0 &&
                renderColumn(null, getProjectsWithoutStatus())}
            </div>
          </DragDropContext>
        </div>
      </div>

      <EnhancedProjectDialog
        defaultStatusId={selectedStatusId}
        onProjectCreated={() => {
          onProjectsChange();
          setSelectedStatusId(null);
        }}
      >
        <Button id="kanban-add-project-trigger" className="hidden">
          Add Project
        </Button>
      </EnhancedProjectDialog>

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