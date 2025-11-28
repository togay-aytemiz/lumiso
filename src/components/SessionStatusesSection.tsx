import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { AddSessionStatusDialog, EditSessionStatusDialog } from "./settings/SessionStatusDialogs";
import { useSessionStatuses } from "@/hooks/useOrganizationData";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";
import { SettingsTwoColumnSection } from "@/components/settings/SettingsSections";

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

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    // For drag and drop with cached data, we need to update the server directly
    // The refetch will update the local state
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!activeOrganizationId) throw new Error('No organization found');

      const items = Array.from(statuses);
      const [reordered] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reordered);

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
      toast.error(t("session_stages.reorder_error"));
    }
  };

  // Create default statuses if none exist
  if (!isLoading && activeOrganizationId && statuses.length === 0) {
    createDefaultStatuses();
  }

  const sectionAction = {
    label: t("session_stages.add_stage"),
    onClick: handleAdd,
    icon: Plus,
    variant: "pill" as const,
    size: "sm" as const,
  };

  if (isLoading) {
    return (
      <SettingsTwoColumnSection
        sectionId="session-statuses"
        title={t("session_stages.title")}
        description={t("session_stages.description")}
        action={sectionAction}
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
        action={sectionAction}
        contentClassName="space-y-6"
      >
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
          <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("session_stages.drag_instructions")}
            </p>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="session-statuses" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={cn(
                    "flex min-h-[48px] flex-wrap gap-3 rounded-lg p-2 transition-colors",
                    snapshot.isDraggingOver && "bg-accent/20"
                  )}
                >
                  {statuses.map((status, index) => (
                    <Draggable
                      key={status.id}
                      draggableId={status.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all select-none",
                            snapshot.isDragging
                              ? "z-50 scale-105 opacity-80 shadow-xl"
                              : "cursor-pointer hover:opacity-80",
                            !snapshot.isDragging && "hover:scale-[1.02]"
                          )}
                          style={{
                            backgroundColor: `${status.color}20`,
                            color: status.color,
                            border: `1px solid ${status.color}40`,
                            ...provided.draggableProps.style,
                          }}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center cursor-grab active:cursor-grabbing hover:opacity-70 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical className="h-3 w-3 text-current opacity-60" />
                          </div>
                          <div
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          <span
                            className="uppercase tracking-wide font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(status);
                            }}
                          >
                            {status.name}
                          </span>
                          {status.lifecycle &&
                            status.lifecycle !== "active" && (
                              <span className="text-xs font-normal capitalize opacity-60">
                                · {t(
                                  `session_status.lifecycle.${status.lifecycle}`
                                )}
                              </span>
                            )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
    </>
  );
};

export default SessionStatusesSection;
