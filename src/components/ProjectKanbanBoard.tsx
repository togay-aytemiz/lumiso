import { useState, useEffect } from "react";
// Import namespace form to avoid ESM/CJS interop edge cases that can surface as
// "Component is not a function" inside DragDropContext's ErrorBoundary.
import * as DnD from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProfessionalKanbanCard } from "@/components/ProfessionalKanbanCard";
import { KanbanLoadingSkeleton } from "@/components/ui/loading-presets";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useKanbanSettings } from "@/hooks/useKanbanSettings";
import { useTranslation } from 'react-i18next';
import { LIFECYCLE_STATES, PROJECT_STATUS } from "@/constants/entityConstants";
import type { ProjectListItem, ProjectStatusSummary } from "@/pages/projects/types";
import { ProjectCreationWizardSheet } from "@/features/project-creation";
import { cn } from "@/lib/utils";
import { promoteProjectToTop, PROJECT_SORT_GAP } from "@/lib/projects/sortOrder";

interface ProjectKanbanBoardProps {
  projects: ProjectListItem[];
  projectStatuses?: ProjectStatusSummary[];
  onProjectsChange: () => void;
  onProjectUpdate?: (project: ProjectListItem) => void;
  onQuickView?: (project: ProjectListItem) => void;
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const GAP = PROJECT_SORT_GAP;

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
  ordered: Array<Pick<ProjectListItem, "id">>
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
  onQuickView,
  isLoading,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: ProjectKanbanBoardProps) => {
  const { t } = useTranslation('forms');
  const toast = useI18nToast();
  const [statuses, setStatuses] = useState<ProjectStatusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [viewingProject, setViewingProject] = useState<ProjectListItem | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [isProjectWizardOpen, setProjectWizardOpen] = useState(false);

  const { triggerProjectMilestone } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();
  const { settings: kanbanSettings } = useKanbanSettings();

  useEffect(() => {
    // Only self-fetch if no statuses were provided at all
    if (typeof projectStatuses === 'undefined') {
      let isMounted = true;

      const fetchStatuses = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Use shared org util instead of RPC to avoid flaky errors
          const { getUserOrganizationId } = await import('@/lib/organizationUtils');
          const organizationId = await getUserOrganizationId();
          if (!organizationId || !isMounted) return;

          const { data, error } = await supabase
            .from("project_statuses")
            .select("*")
            .eq("organization_id", organizationId)
            .order("sort_order", { ascending: true });

          if (error) throw error;
          if (!isMounted) return;
          setStatuses(((data || []) as ProjectStatusSummary[]).filter(s => s.name?.toLowerCase?.() !== PROJECT_STATUS.ARCHIVED));
        } catch (error: unknown) {
          console.error("Error fetching project statuses:", error);
          if (isMounted) {
            // Avoid noisy toasts when board is not visible
            toast.error(t('forms:projects.toasts.statuses_load_failed'));
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      void fetchStatuses();
      return () => {
        isMounted = false;
      };
    }
    // When provided (even empty initially), use them and avoid duplicate fetches
    const filteredStatuses = (projectStatuses || []).filter(
      status => status.name?.toLowerCase?.() !== PROJECT_STATUS.ARCHIVED
    );

    setStatuses(previous => {
      if (previous.length === filteredStatuses.length) {
        const hasDifference = previous.some((status, index) => {
          const next = filteredStatuses[index];
          if (!next) return true;
          return (
            status.id !== next.id ||
            status.name !== next.name ||
            status.color !== next.color ||
            status.lifecycle !== next.lifecycle ||
            status.sort_order !== next.sort_order
          );
        });

        if (!hasDifference) {
          return previous;
        }
      }

      return filteredStatuses;
    });
    setLoading(false);
    return undefined;
  }, [projectStatuses, toast, t]);

  const getProjectsByStatus = (statusId: string) =>
    orderProjects(projects.filter(p => p.status_id === statusId));

  const getProjectsWithoutStatus = () =>
    orderProjects(projects.filter(p => !p.status_id));

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const projectId = draggableId;
    const srcStatusId = source.droppableId === "no-status" ? null : source.droppableId;
    const dstStatusId = destination.droppableId === "no-status" ? null : destination.droppableId;

    const moving = projects.find(p => p.id === projectId);
    if (!moving) return;

    const organizationId = activeOrganization?.id ?? null;
    const shouldForceRefresh = !onProjectUpdate;

    const dstBase = orderProjects(projects.filter(p => p.status_id === dstStatusId && p.id !== moving.id));
    const insertIndex = Math.min(Math.max(destination.index, 0), dstBase.length);

    const dstWithMoving: ProjectListItem[] = [...dstBase];
    const projectForInsertion: ProjectListItem = { ...moving, status_id: dstStatusId };
    dstWithMoving.splice(insertIndex, 0, projectForInsertion);

    const { value, needReindex } = computeSortForInsert(dstWithMoving, insertIndex);
    const requiresReindex = needReindex || value === null;

    const srcAfterMove =
      srcStatusId !== dstStatusId
        ? orderProjects(projects.filter(p => p.status_id === srcStatusId && p.id !== moving.id))
        : [];

    if (onProjectUpdate) {
      if (!requiresReindex && value !== null) {
        onProjectUpdate({
          ...moving,
          status_id: dstStatusId,
          sort_order: value,
        });
      } else {
        const updatedDest = dstWithMoving.map((project, idx) => ({
          ...project,
          status_id: dstStatusId,
          sort_order: (idx + 1) * GAP,
        }));
        updatedDest.forEach(project => onProjectUpdate(project));

        if (srcStatusId !== dstStatusId && srcAfterMove.length > 0) {
          const updatedSrc = srcAfterMove.map((project, idx) => ({
            ...project,
            status_id: srcStatusId,
            sort_order: (idx + 1) * GAP,
          }));
          updatedSrc.forEach(project => onProjectUpdate(project));
        }
      }
    }

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

        // Update project position in database
        if (!requiresReindex && value !== null) {
          const { error } = await supabase
            .from("projects")
            .update({ status_id: dstStatusId, sort_order: value })
            .eq("id", projectId);
          if (error) throw error;
        } else {
          await reindexColumn(dstStatusId, dstWithMoving);
          if (srcStatusId !== dstStatusId) {
            await reindexColumn(srcStatusId, srcAfterMove);
          }
        }

        // Handle status change activities and notifications
        if (srcStatusId !== dstStatusId) {
          const oldStatus = statuses.find(s => s.id === moving.status_id);
          const newStatus = statuses.find(s => s.id === (dstStatusId || ""));
          
          // Insert activity log
          const noStatusLabel = t('pages:projects.noStatus');
          const statusChangeContent = t('activities.status_changed', {
            old: oldStatus?.name || noStatusLabel,
            next: newStatus?.name || noStatusLabel,
          });
          const activityPromise = organizationId
            ? supabase.from("activities").insert({
                type: "status_change",
                content: statusChangeContent,
                project_id: projectId,
                lead_id: moving.lead_id,
                user_id: user.id,
                organization_id: organizationId,
              })
            : Promise.resolve();

          // TEMPORARILY SKIP milestone notifications for completed/cancelled to test performance
          const shouldSkipNotification =
            newStatus?.lifecycle === LIFECYCLE_STATES.COMPLETED || newStatus?.lifecycle === LIFECYCLE_STATES.CANCELLED;
          
          const notificationPromise =
            !shouldSkipNotification && organizationId && triggerProjectMilestone 
            ? triggerProjectMilestone(
                projectId,
                srcStatusId || "",
                dstStatusId || "",
                organizationId
              ).catch(error => console.error("Failed to trigger milestone notification:", error))
            : Promise.resolve();

          if (shouldSkipNotification) {
            // Milestone notification triggered for status change
          }

          // Wait for both operations in parallel
          await Promise.all([activityPromise, notificationPromise]);
        }

        // Background database operations completed; fall back to full refresh only when local state wasn't updated
        if (shouldForceRefresh && onProjectsChange) {
          onProjectsChange();
        }
    } catch (error: unknown) {
      console.error("Error in background database operations:", error);
        // Sync with server to reflect actual state
        if (onProjectsChange) {
          onProjectsChange();
        }
        toast.error(t('forms:projects.toasts.move_sync_failed'));
      }
    })();
  };

  const handleAddProject = (statusId: string | null) => {
    setSelectedStatusId(statusId);
    setProjectWizardOpen(true);
  };

  const handleProjectClick = (project: ProjectListItem) => {
    if (onQuickView) onQuickView(project);
    else {
      setViewingProject(project);
      setShowViewDialog(true);
    }
  };

  const renderProjectCard = (project: ProjectListItem, index: number) => (
    <DnD.Draggable key={project.id} draggableId={project.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2 last:mb-0"
        >
          <ProfessionalKanbanCard
            project={project}
            kanbanSettings={kanbanSettings}
            onClick={() => handleProjectClick(project)}
          />
        </div>
      )}
    </DnD.Draggable>
  );

  const renderColumn = (status: ProjectStatusSummary | null, columnProjects: ProjectListItem[]) => {
    const statusId = status?.id || "no-status";
    const statusName = status?.name || t('pages:projects.noStatus');
    const statusColor = status?.color || "#6B7280";

    const ordered = orderProjects(columnProjects);

    return (
      <div
        key={statusId}
        className="flex w-72 flex-shrink-0 flex-col rounded-2xl border border-border/40 bg-muted/30"
      >
        <div className="flex items-center justify-between gap-1.5 px-2.5 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
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

        <DnD.Droppable droppableId={statusId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "relative flex flex-col gap-2.5 px-2.5 pb-3 pt-1",
                snapshot.isDraggingOver && "bg-accent/10"
              )}
            >
              <div className="flex flex-col">
                {ordered.map((project, index) => renderProjectCard(project, index))}
              </div>

              <div>
                {ordered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background/60 px-3 py-7 text-center">
                    <Button
                      variant="outline"
                      onClick={() => handleAddProject(status?.id || null)}
                      className="flex items-center gap-1.5 border-dashed"
                    >
                      <Plus className="h-4 w-4" />
                      {t('common:buttons.add_project')}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t('forms:projects.drop_here')}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleAddProject(status?.id || null)}
                    className="w-full flex items-center gap-1.5 border-dashed"
                  >
                    <Plus className="h-4 w-4" />
                    {t('common:buttons.add_project')}
                  </Button>
                )}
              </div>

              <div className="flex-1 min-h-10" />
              {provided.placeholder}

              {snapshot.isDraggingOver && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-accent/40">
                  <span className="text-sm font-medium text-accent">
                    {t('forms:projects.drop_here')}
                  </span>
                </div>
              )}
            </div>
          )}
        </DnD.Droppable>
      </div>
    );
  };

  if (loading || isLoading) return <KanbanLoadingSkeleton />;

  const showLoadMore = Boolean(hasMore && onLoadMore);
  const loadMoreLabel = t('common:buttons.load_more', { defaultValue: 'Load more' });

  return (
    <>
      <div
        className="w-full max-w-full overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin", touchAction: "pan-x pan-y" }}
      >
        <div className="px-3 py-3 sm:px-5 sm:py-4">
          <DnD.DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex items-start gap-2.5 sm:gap-3 pb-3" style={{ width: "max-content", minWidth: "100%" }}>
              {statuses.map(status => renderColumn(status, getProjectsByStatus(status.id)))}
              {getProjectsWithoutStatus().length > 0 && renderColumn(null, getProjectsWithoutStatus())}
            </div>
          </DnD.DragDropContext>
        </div>
      </div>

      <ProjectCreationWizardSheet
        isOpen={isProjectWizardOpen}
        onOpenChange={(open) => {
          setProjectWizardOpen(open);
          if (!open) {
            setSelectedStatusId(null);
          }
        }}
        defaultStatusId={selectedStatusId}
        entrySource="kanban"
        onProjectCreated={async (createdProject) => {
          if (createdProject?.id) {
            await promoteProjectToTop(createdProject.id);
          }
          onProjectsChange();
          setSelectedStatusId(null);
        }}
      />

      <ViewProjectDialog
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onProjectUpdated={onProjectsChange}
        onActivityUpdated={() => {}}
        leadName={viewingProject?.lead?.name || ""}
      />
      {showLoadMore ? (
        <div className="px-4 pb-6 flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {loadMoreLabel}
          </Button>
        </div>
      ) : null}
    </>
  );
};

export default ProjectKanbanBoard;
