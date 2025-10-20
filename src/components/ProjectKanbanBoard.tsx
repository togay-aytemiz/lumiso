import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProfessionalKanbanCard } from "@/components/ProfessionalKanbanCard";
import { KanbanLoadingSkeleton } from "@/components/ui/loading-presets";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useKanbanSettings } from "@/hooks/useKanbanSettings";
import { useTranslation } from 'react-i18next';
import { LIFECYCLE_STATES, PROJECT_STATUS } from "@/constants/entityConstants";
import type { ProjectListItem, ProjectStatusSummary } from "@/pages/projects/types";

interface ProjectKanbanBoardProps {
  projects: ProjectListItem[];
  projectStatuses?: ProjectStatusSummary[];
  onProjectsChange: () => void;
  onProjectUpdate?: (project: ProjectListItem) => void;
  onQuickView?: (project: ProjectListItem) => void;
}

const GAP = 1000;

const orderProjects = (list: ProjectListItem[]) =>
  [...list].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ad - bd;
  });

function computeSortForInsert(
  withMoving: ProjectListItem[],
  index: number
): { value: number | null; needReindex: boolean } {
  const prev = index > 0 ? withMoving[index - 1] : undefined;
  const next = index < withMoving.length - 1 ? withMoving[index + 1] : undefined;

  if (!prev && !next) return { value: GAP, needReindex: false };
  if (!prev && next) {
    const nextOrder = next.sort_order ?? GAP;
    return { value: nextOrder - GAP, needReindex: false };
  }
  if (prev && !next) {
    const prevOrder = prev.sort_order ?? 0;
    return { value: prevOrder + GAP, needReindex: false };
  }

  const prevOrder = prev?.sort_order ?? 0;
  const nextOrder = next?.sort_order ?? prevOrder + 2;

  if (nextOrder - prevOrder >= 2) {
    return { value: Math.floor((prevOrder + nextOrder) / 2), needReindex: false };
  }
  return { value: null, needReindex: true };
}

async function reindexColumn(
  statusId: string | null,
  ordered: ProjectListItem[]
) {
  await Promise.all(
    ordered.map((p, i) =>
      supabase
        .from("projects")
        .update({ status_id: statusId, sort_order: (i + 1) * GAP })
        .eq("id", p.id)
    )
  );
}

const ProjectKanbanBoard = ({
  projects,
  projectStatuses,
  onProjectsChange,
  onProjectUpdate,
  onQuickView
}: ProjectKanbanBoardProps) => {
  const { t } = useTranslation('forms');
  const toast = useI18nToast();
  const [statuses, setStatuses] = useState<ProjectStatusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [viewingProject, setViewingProject] = useState<ProjectListItem | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const { triggerProjectMilestone } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();
  const { settings: kanbanSettings } = useKanbanSettings();

  useEffect(() => {
    if (projectStatuses && projectStatuses.length > 0) {
      setStatuses(projectStatuses.filter(s => s.name?.toLowerCase?.() !== PROJECT_STATUS.ARCHIVED));
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
      setStatuses(((data || []) as ProjectStatusSummary[]).filter(s => s.name?.toLowerCase?.() !== PROJECT_STATUS.ARCHIVED));
    } catch (error) {
      console.error("Error fetching project statuses:", error);
      toast.error(t('forms:projects.toasts.statuses_load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const getProjectsByStatus = (statusId: string) =>
    orderProjects(projects.filter(p => p.status_id === statusId));

  const getProjectsWithoutStatus = () =>
    orderProjects(projects.filter(p => !p.status_id));

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const projectId = draggableId;
    const srcStatusId = source.droppableId === "no-status" ? null : source.droppableId;
    const dstStatusId = destination.droppableId === "no-status" ? null : destination.droppableId;

    const moving = projects.find(p => p.id === projectId);
    if (!moving) return;

    // OPTIMISTIC UPDATE: Update UI immediately (defer server refetch until after DB writes)
    if (onProjectUpdate) onProjectUpdate({ ...moving, status_id: dstStatusId });

    // Show immediate feedback
    if (srcStatusId !== dstStatusId) {
      const oldStatus = statuses.find(s => s.id === moving.status_id);
      const newStatus = statuses.find(s => s.id === (dstStatusId || ""));
      toast.success(t('forms:projects.toasts.moved_to', { status: newStatus?.name || t('pages:projects.noStatus') }));
    } else {
      toast.success(t('forms:projects.toasts.position_updated'));
    }

    // BACKGROUND OPERATIONS: Handle all database operations async
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error(t('forms:user_not_authenticated'));

        const dstBase = orderProjects(projects.filter(p => p.status_id === dstStatusId && p.id !== moving.id));
        const insertIndex = Math.min(Math.max(destination.index, 0), dstBase.length);

        const dstWithMoving: ProjectListItem[] = [...dstBase];
        dstWithMoving.splice(insertIndex, 0, { ...moving, status_id: dstStatusId });

        const { value, needReindex } = computeSortForInsert(dstWithMoving, insertIndex);

        // Update project position in database
        if (!needReindex && value !== null) {
          const { error } = await supabase
            .from("projects")
            .update({ status_id: dstStatusId, sort_order: value })
            .eq("id", projectId);
          if (error) throw error;
        } else {
          await reindexColumn(dstStatusId, dstWithMoving);
          if (srcStatusId !== dstStatusId) {
            const srcAfterMove = orderProjects(projects.filter(p => p.status_id === srcStatusId && p.id !== moving.id));
            await reindexColumn(srcStatusId, srcAfterMove);
          }
        }

        // Handle status change activities and notifications
        if (srcStatusId !== dstStatusId) {
          const oldStatus = statuses.find(s => s.id === moving.status_id);
          const newStatus = statuses.find(s => s.id === (dstStatusId || ""));
          
          // Insert activity log
          const activityPromise = supabase.from("activities").insert({
            type: "status_change",
            content: `Status changed from '${oldStatus?.name || "No Status"}' to '${newStatus?.name || "No Status"}'`,
            project_id: projectId,
            lead_id: moving.lead_id,
            user_id: user.id
          });

          // TEMPORARILY SKIP milestone notifications for completed/cancelled to test performance
          const shouldSkipNotification = newStatus?.lifecycle === LIFECYCLE_STATES.COMPLETED || newStatus?.lifecycle === LIFECYCLE_STATES.CANCELLED;
          
          const notificationPromise = !shouldSkipNotification && activeOrganization?.id && triggerProjectMilestone 
            ? triggerProjectMilestone(
                projectId,
                srcStatusId || "",
                dstStatusId || "",
                activeOrganization.id,
                [] // Single photographer mode - no assignees
              ).catch(error => console.error("Failed to trigger milestone notification:", error))
            : Promise.resolve();

          if (shouldSkipNotification) {
            // Milestone notification triggered for status change
          }

          // Wait for both operations in parallel
          await Promise.all([activityPromise, notificationPromise]);
        }

        // Background database operations completed, now refresh from server to ensure consistency
        onProjectsChange();
      } catch (error) {
        console.error("Error in background database operations:", error);
        // Sync with server to reflect actual state
        onProjectsChange();
        toast.error(t('forms:projects.toasts.move_sync_failed'));
      }
    })();
  };

  const handleAddProject = (statusId: string | null) => {
    setSelectedStatusId(statusId);
    const triggerButton = document.getElementById("kanban-add-project-trigger");
    triggerButton?.click();
  };

  const handleProjectClick = (project: ProjectListItem) => {
    if (onQuickView) onQuickView(project);
    else {
      setViewingProject(project);
      setShowViewDialog(true);
    }
  };

  const renderProjectCard = (project: ProjectListItem, index: number) => (
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

  const renderColumn = (status: ProjectStatusSummary | null, columnProjects: ProjectListItem[]) => {
    const statusId = status?.id || "no-status";
    const statusName = status?.name || t('pages:projects.noStatus');
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
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
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
                className={`h-full flex flex-col transition-colors ${snapshot.isDraggingOver ? "bg-accent/20 rounded" : ""}`}
              >
                {/* Projects area */}
                <div className="flex flex-col gap-2 mb-3">
                  {ordered.map((project, index) => renderProjectCard(project, index))}
                </div>

                {/* Add Project Button */}
                <div className="mb-3">
                  {ordered.length === 0 ? (
                    <div className="flex items-center justify-center h-32 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                      <Button
                        variant="outline"
                        onClick={() => handleAddProject(status?.id || null)}
                        className="flex items-center gap-2 border-dashed"
                      >
                        <Plus className="h-4 w-4" />
                        {t('common:buttons.add_project')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleAddProject(status?.id || null)}
                      className="w-full flex items-center gap-2 border-dashed"
                    >
                      <Plus className="h-4 w-4" />
                      {t('common:buttons.add_project')}
                    </Button>
                  )}
                </div>

                {/* Large drop zone area */}
                <div className="flex-1 min-h-32 relative">
                  {provided.placeholder}
                  {snapshot.isDraggingOver && (
                    <div className="absolute inset-0 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5 flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">{t('forms:projects.drop_here')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Droppable>
        </div>
      </div>
    );
  };

  if (loading) return <KanbanLoadingSkeleton />;

  return (
    <>
      <div
        className="h-full w-full max-w-full overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin", touchAction: "pan-x pan-y" }}
      >
        <div className="p-4 sm:p-6 h-full">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-2 sm:gap-3 pb-4 h-full" style={{ width: "max-content", minWidth: "100%" }}>
              {statuses.map(status => renderColumn(status, getProjectsByStatus(status.id)))}
              {getProjectsWithoutStatus().length > 0 && renderColumn(null, getProjectsWithoutStatus())}
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
        <Button id="kanban-add-project-trigger" className="hidden">{t('kanban.add_project')}</Button>
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
