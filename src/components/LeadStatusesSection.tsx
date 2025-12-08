import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Edit, Trash2, GripVertical, Settings } from "lucide-react";
import { useI18nToast } from "@/lib/toastHelpers";
import { supabase } from "@/integrations/supabase/client";
import { AddLeadStatusDialog, EditLeadStatusDialog } from "./settings/LeadStatusDialogs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SettingsTwoColumnSection } from "@/components/settings/SettingsSections";
import { useLeadStatuses, useOrganizationSettings } from "@/hooks/useOrganizationData";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";

const leadStatusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be less than 50 characters"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code"),
});

type LeadStatusForm = z.infer<typeof leadStatusSchema>;

interface LeadStatus {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
  is_default: boolean;
  is_system_final?: boolean;
  lifecycle?: string;
}

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return undefined;
};

// Predefined color palette
const PREDEFINED_COLORS = [
  '#F56565', // Red
  '#ED8936', // Orange  
  '#ECC94B', // Yellow
  '#9AE6B4', // Light Green
  '#48BB78', // Green
  '#38B2AC', // Teal
  '#63B3ED', // Light Blue
  '#4299E1', // Blue
  '#667EEA', // Indigo
  '#9F7AEA', // Purple
  '#ED64A6', // Pink
  '#A0AEC0', // Gray
];

const LeadStatusesSection = () => {
  const [submitting, setSubmitting] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(PREDEFINED_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [isReorderSheetOpen, setIsReorderSheetOpen] = useState(false);
  const [reorderStatuses, setReorderStatuses] = useState<LeadStatus[]>([]);

  const toast = useI18nToast();
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { t } = useTranslation('forms');
  
  // Use cached data
  const { data: statuses = [], isLoading } = useLeadStatuses();
  const {
    settings: organizationSettings,
    loading: settingsLoading,
    updateSettings: updateOrganizationSettings,
  } = useOrganizationSettings();

  // Check for lifecycle completeness and show warnings
  useEffect(() => {
    if (statuses.length > 0 && !isLoading) {
      const hasCompleted = statuses.some(s => s.lifecycle === 'completed');
      const hasCancelled = statuses.some(s => s.lifecycle === 'cancelled');
      
      if (!hasCompleted || !hasCancelled) {
        const timeoutId = setTimeout(() => {
          toast.info(t('lead_statuses.lifecycle_warning'));
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [statuses, isLoading, toast, t]);

  const form = useForm<LeadStatusForm>({
    resolver: zodResolver(leadStatusSchema),
    defaultValues: {
      name: "",
      color: PREDEFINED_COLORS[0],
    },
  });

  const updatePreference = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      const result = await updateOrganizationSettings({ [key]: value });
      if (result.success) {
        toast.success(t('lead_statuses.preferences_updated'));
      }
    } catch (error: unknown) {
      console.error('Error updating setting:', error);
      const message = getErrorMessage(error);
      toast.error(message ?? t('lead_statuses.update_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (status: LeadStatus) => {
    setEditingStatus(status);
    setSelectedColor(status.color);
    form.reset({ name: status.name, color: status.color });
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingStatus(null);
    form.reset({ name: "", color: PREDEFINED_COLORS[0] });
    setSelectedColor(PREDEFINED_COLORS[0]);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (statusId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if this is a system final status
      const statusToDelete = statuses.find(s => s.id === statusId);
      if (statusToDelete?.is_system_final) {
        throw new Error('Cannot delete system statuses (Completed/Lost). These are required for lead management.');
      }

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', statusId)
        .eq('organization_id', organizationId);

      if (error) {
        if (error.code === '23503') {
          throw new Error('Cannot delete this status because it is being used by existing leads. Please change those leads to a different status first.');
        }
        throw error;
      }

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });

      toast.success(t('lead_status.success.deleted'));
    } catch (error) {
      console.error('Error deleting lead status:', error);
      toast.error(error instanceof Error ? error.message : t('lead_status.errors.delete_failed'));
    }
  };

  const customStatuses = useMemo(
    () => statuses.filter(status => !status.is_system_final).sort((a, b) => a.sort_order - b.sort_order),
    [statuses]
  );
  const systemStatuses = statuses.filter(status => status.is_system_final);

  useEffect(() => {
    if (isReorderSheetOpen) {
      setReorderStatuses(customStatuses);
    }
  }, [isReorderSheetOpen, customStatuses]);

  const handleReorderDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const previous = reorderStatuses;
    const items = Array.from(reorderStatuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setReorderStatuses(items);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates = items.map((status, index) => ({
        id: status.id,
        sort_order: systemStatuses.length + index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('lead_statuses')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });
      toast.success(t('lead_statuses.reorder_success'));
    } catch (error) {
      console.error('Error updating status order:', error);
      setReorderStatuses(previous);
      toast.error(t('lead_statuses.reorder_error'));
    }
  };

  const sectionAction = {
    label: t('lead_statuses.add_status'),
    onClick: handleAdd,
    icon: Plus,
    variant: "pill" as const,
    size: "sm" as const,
  };

  if (isLoading) {
    return (
      <SettingsTwoColumnSection
        sectionId="lead-statuses"
        title={t('lead_statuses.title')}
        description={t('lead_statuses.description')}
        action={sectionAction}
        contentClassName="space-y-6"
      >
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="space-y-4">
            <div className="h-8 rounded bg-muted animate-pulse" />
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 w-24 rounded-full bg-muted animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </SettingsTwoColumnSection>
    );
  }

  // Get system statuses for dynamic description
  const systemStatusNames = systemStatuses.map(s => s.name).join(' and ');
  const dynamicDescription = systemStatusNames 
    ? t('lead_statuses.show_quick_buttons_help', { systemStatuses: systemStatusNames.toLowerCase() })
    : t('lead_statuses.show_quick_buttons_help_default');

  const showQuickButtons = organizationSettings?.show_quick_status_buttons ?? true;

  return (
    <>
      <SettingsTwoColumnSection
        sectionId="lead-statuses"
        title={t('lead_statuses.title')}
        description={t('lead_statuses.description')}
        action={sectionAction}
        contentClassName="space-y-6"
      >
        <div className="space-y-6 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 sm:items-center">
              <div className="space-y-0.5">
                <Label htmlFor="quick-status-buttons" className="text-sm font-medium leading-tight">
                  {t('lead_statuses.show_quick_buttons')}
                </Label>
              </div>
              <Switch
                id="quick-status-buttons"
                checked={showQuickButtons}
                onCheckedChange={(checked) => updatePreference('show_quick_status_buttons', checked)}
                disabled={saving || settingsLoading}
                className="mt-1 shrink-0 sm:mt-0"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {dynamicDescription}
            </p>
          </div>

          {/* System Statuses Section */}
          {showQuickButtons && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('lead_statuses.system_statuses')}</h4>
              
              <div className="flex flex-wrap gap-3">
                {systemStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all hover:opacity-80 cursor-pointer"
                    style={{ 
                      backgroundColor: status.color + '20',
                      color: status.color,
                      border: `1px solid ${status.color}40`
                    }}
                    onClick={() => handleEdit(status)}
                  >
                    <div 
                      className="h-2 w-2 flex-shrink-0 rounded-full" 
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-left text-sm font-semibold uppercase tracking-wide break-words">
                      {status.name}
                    </span>
                    {status.lifecycle && status.lifecycle !== 'active' && (
                      <span className="text-left text-xs font-normal capitalize opacity-60 break-words">
                        · {t(`lead_status.lifecycle.${status.lifecycle}`)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Statuses Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('lead_statuses.custom_statuses')}</h4>
            
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <span className="leading-relaxed">{t('lead_statuses.drag_instructions')}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="surface"
                className="inline-flex w-full items-center gap-2 sm:w-auto sm:self-start"
                onClick={() => {
                  setReorderStatuses(customStatuses);
                  setIsReorderSheetOpen(true);
                }}
              >
                <GripVertical className="h-4 w-4" />
                {t('lead_statuses.reorder_button')}
              </Button>
            </div>

            <div className="grid gap-3">
              {customStatuses.map((status) => (
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
                      {status.lifecycle && status.lifecycle !== 'active' && (
                        <span className="text-xs text-muted-foreground">
                          {status.lifecycle}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground text-right leading-snug max-w-[96px] whitespace-normal sm:max-w-none sm:text-left">
                    {t('lead_statuses.tap_to_edit')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Add Dialog */}
        <AddLeadStatusDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onStatusAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });
          }}
        />

        {/* Edit Dialog */}
        <EditLeadStatusDialog
          status={editingStatus}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onStatusUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });
          }}
        />
      </SettingsTwoColumnSection>

      <AppSheetModal
        title={t('lead_statuses.reorder_sheet_title')}
        isOpen={isReorderSheetOpen}
        onOpenChange={setIsReorderSheetOpen}
        size="md"
        footerActions={[
          {
            label: t('lead_statuses.reorder_done'),
            onClick: () => setIsReorderSheetOpen(false),
          },
        ]}
      >
        <p className="text-sm text-muted-foreground">
          {t('lead_statuses.reorder_sheet_description')}
        </p>

        <DragDropContext onDragEnd={handleReorderDragEnd}>
          <Droppable droppableId="lead-custom-statuses-reorder" direction="vertical">
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
                            {status.lifecycle && status.lifecycle !== 'active' && (
                              <p className="text-xs text-muted-foreground">
                                {status.lifecycle}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground text-right leading-snug max-w-[96px] whitespace-normal sm:max-w-none sm:text-left">
                          {t('lead_statuses.reorder_hint')}
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

export default LeadStatusesSection;
