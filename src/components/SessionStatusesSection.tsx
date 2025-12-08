import { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { Button } from "@/components/ui/button";
import { AddSessionStatusDialog, EditSessionStatusDialog } from "./settings/SessionStatusDialogs";
import { useSessionStatuses } from "@/hooks/useOrganizationData";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";
import { SettingsTwoColumnSection } from "@/components/settings/SettingsSections";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";

interface SessionStatus {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_system_initial: boolean;
  created_at: string;
  updated_at: string;
  lifecycle?: string;
}

const SessionStatusesSection = () => {
  const [editingStatus, setEditingStatus] = useState<SessionStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReorderSheetOpen, setIsReorderSheetOpen] = useState(false);
  const [reorderStatuses, setReorderStatuses] = useState<SessionStatus[]>([]);
  const toast = useI18nToast();
  const { activeOrganizationId } = useOrganization();
  const { data: statuses = [], isLoading, refetch } = useSessionStatuses();
  const { t } = useTranslation('forms');

  // Check for lifecycle completeness and show warnings
  useEffect(() => {
    if (statuses.length > 0 && !isLoading) {
      const hasCompleted = statuses.some(s => s.lifecycle === 'completed');
      const hasCancelled = statuses.some(s => s.lifecycle === 'cancelled');
      
      if (!hasCompleted || !hasCancelled) {
        const timeoutId = setTimeout(() => {
          toast.info(t("session_stages.lifecycle_warning"), { duration: 8000 });
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [statuses, isLoading, t, toast]);

  const createDefaultStatuses = async () => {
    if (!activeOrganizationId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('ensure_default_session_statuses', {
        user_uuid: user.id,
        org_id: activeOrganizationId
      });

      await refetch();
    } catch (error) {
      console.error('Error creating default session statuses:', error);
      toast.error(t("session_stages.toasts.default_create_error"));
    }
  };

  const handleEdit = (status: SessionStatus) => {
    setEditingStatus(status);
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingStatus(null);
    setIsAddDialogOpen(true);
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingStatus(null);
    }
  };

  const visibleStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.sort_order - b.sort_order),
    [statuses]
  );

  useEffect(() => {
    if (isReorderSheetOpen) {
      setReorderStatuses(visibleStatuses);
    }
  }, [isReorderSheetOpen, visibleStatuses]);

  const handleReorderDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const previousOrder = reorderStatuses;
    const items = Array.from(reorderStatuses);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setReorderStatuses(items);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!activeOrganizationId) throw new Error('No organization found');

      for (let i = 0; i < items.length; i++) {
        const s = items[i];
        const { error } = await supabase
          .from('session_statuses')
          .update({ sort_order: i + 1 })
          .eq('id', s.id)
          .eq('organization_id', activeOrganizationId);
        if (error) throw error;
      }
      toast.success(t("session_stages.reorder_success"));
      await refetch();
    } catch (error: unknown) {
      console.error('Error updating order:', error);
      setReorderStatuses(previousOrder);
      toast.error(t("session_stages.reorder_error"));
    }
  };

  // Create default statuses if none exist
  if (!isLoading && activeOrganizationId && statuses.length === 0) {
    createDefaultStatuses();
  }

  const actionSlot = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="sm"
        variant="surface"
        className="inline-flex w-full items-center gap-2 sm:w-auto sm:self-start"
        onClick={handleAdd}
      >
        <Plus className="h-4 w-4" />
        {t("session_stages.add_stage")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="surface"
        className="inline-flex w-full items-center gap-2 sm:w-auto sm:self-start"
        onClick={() => {
          setReorderStatuses(visibleStatuses);
          setIsReorderSheetOpen(true);
        }}
      >
        <GripVertical className="h-4 w-4" />
        {t("session_stages.reorder_button")}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <SettingsTwoColumnSection
        sectionId="session-statuses"
        title={t("session_stages.title")}
        description={t("session_stages.description")}
        actionSlot={actionSlot}
        contentClassName="space-y-6"
      >
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <FormLoadingSkeleton rows={3} />
        </div>
      </SettingsTwoColumnSection>
    );
  }

  return (
    <>
      <SettingsTwoColumnSection
        sectionId="session-statuses"
        title={t("session_stages.title")}
        description={t("session_stages.description")}
        actionSlot={actionSlot}
        contentClassName="space-y-6"
      >
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <span className="leading-relaxed">{t("session_stages.drag_instructions")}</span>
            </div>
          </div>

          <div className="grid gap-3">
            {visibleStatuses.map((status) => (
              <button
                key={status.id}
                type="button"
                onClick={() => handleEdit(status)}
                className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-left transition hover:border-border hover:bg-muted/60"
                style={{ boxShadow: `inset 0 0 0 1px ${status.color}26` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold uppercase tracking-wide"
                      style={{ color: status.color }}
                    >
                      {status.name}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground text-right leading-snug max-w-[96px] whitespace-normal sm:max-w-none sm:text-left">
                  {t("session_stages.tap_to_edit")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </SettingsTwoColumnSection>

      <AddSessionStatusDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onStatusAdded={refetch}
      />

      <EditSessionStatusDialog
        status={editingStatus}
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogChange}
        onStatusUpdated={refetch}
      />

      <AppSheetModal
        title={t("session_stages.reorder_sheet_title")}
        isOpen={isReorderSheetOpen}
        onOpenChange={setIsReorderSheetOpen}
        size="md"
        footerActions={[
          {
            label: t("session_stages.reorder_done"),
            onClick: () => setIsReorderSheetOpen(false),
          },
        ]}
      >
        <p className="text-sm text-muted-foreground">
          {t("session_stages.reorder_sheet_description")}
        </p>

        <DragDropContext onDragEnd={handleReorderDragEnd}>
          <Droppable droppableId="session-statuses-reorder" direction="vertical">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="mt-3 flex flex-col gap-2"
              >
                {reorderStatuses.map((status, index) => (
                  <Draggable key={status.id} draggableId={status.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={provided.draggableProps.style}
                        className={cn(
                          "flex items-center justify-between rounded-lg border border-border/80 bg-card px-3 py-2 transition",
                          snapshot.isDragging && "shadow-lg ring-2 ring-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-semibold uppercase tracking-wide"
                              style={{ color: status.color }}
                            >
                              {status.name}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground text-right leading-snug max-w-[96px] whitespace-normal sm:max-w-none sm:text-left">
                          {t("session_stages.reorder_hint")}
                        </span>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </AppSheetModal>
    </>
  );
};

export default SessionStatusesSection;
