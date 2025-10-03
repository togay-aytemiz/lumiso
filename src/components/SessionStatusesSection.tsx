import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { toast as toastFn } from "@/hooks/use-toast";
import { AddSessionStatusDialog, EditSessionStatusDialog } from "./settings/SessionStatusDialogs";
import { useSessionStatuses } from "@/hooks/useOrganizationData";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";
import SettingsSection from "./SettingsSection";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";

const sessionStatusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be less than 50 characters"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code"),
});

type SessionStatusForm = z.infer<typeof sessionStatusSchema>;

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

const SessionStatusesSection = () => {
  const [editingStatus, setEditingStatus] = useState<SessionStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
          toastFn({
            title: "Tip",
            description: "Add at least one Completed and one Cancelled stage to unlock full automations.",
            variant: "default",
            duration: 8000,
          });
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [statuses, isLoading]);

  const form = useForm<SessionStatusForm>({
    resolver: zodResolver(sessionStatusSchema),
    defaultValues: { name: "", color: PREDEFINED_COLORS[0] },
  });

  const selectedColor = form.watch("color");

  const isProtectedStatus = (status: SessionStatus | null) => {
    if (!status) return false;
    const n = status.name?.trim().toLowerCase();
    return status.is_system_initial || n === 'completed' || n === 'cancelled';
  };

  const createDefaultStatuses = async () => {
    if (!activeOrganizationId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('ensure_default_session_statuses', {
        user_uuid: user.id
      });

      await refetch();
    } catch (error) {
      console.error('Error creating default session statuses:', error);
      toast.error("Failed to create default session statuses");
    }
  };

  const onSubmit = async (data: SessionStatusForm) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingStatus) {
        if (!activeOrganizationId) throw new Error('No organization found');

        const { error } = await supabase
          .from('session_statuses')
          .update({ name: data.name, color: data.color })
          .eq('id', editingStatus.id)
          .eq('organization_id', activeOrganizationId);
        if (error) throw error;
        toast.success("Session stage updated");
        setIsEditDialogOpen(false);
      } else {
        const maxSortOrder = Math.max(...statuses.map(s => s.sort_order), 0);
        if (!activeOrganizationId) throw new Error('No organization found');

        const { error } = await supabase
          .from('session_statuses')
          .insert({ 
            name: data.name, 
            color: data.color, 
            user_id: user.id, 
            organization_id: activeOrganizationId,
            sort_order: maxSortOrder + 1, 
            is_system_initial: false 
          });
        if (error) throw error;
        toast.success("Session stage created");
        setIsAddDialogOpen(false);
      }

      form.reset({ name: "", color: PREDEFINED_COLORS[0] });
      setEditingStatus(null);
      await refetch();
    } catch (error: any) {
      console.error('Error saving session status:', error);
      toast.error(error?.message || 'Failed to save session stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (status: SessionStatus) => {
    setEditingStatus(status);
    form.reset({ name: status.name, color: status.color });
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingStatus(null);
    form.reset({ name: "", color: PREDEFINED_COLORS[0] });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (status: SessionStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (isProtectedStatus(status)) {
        toast.error(`The "${status.name}" stage cannot be deleted`);
        return;
      }
      if (!activeOrganizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('session_statuses')
        .delete()
        .eq('id', status.id)
        .eq('organization_id', activeOrganizationId);
      if (error) throw error;
      toast.success("Session stage deleted");
      await refetch();
    } catch (error: any) {
      console.error('Error deleting session status:', error);
      toast.error(error?.message || 'Failed to delete session stage');
    }
  };

  const handleDragEnd = async (result: any) => {
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
      toast.success("Stage order updated");
      await refetch();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const renderColorSwatches = (onSelect: (color: string) => void) => (
    <div className="grid grid-cols-6 gap-2">
      {PREDEFINED_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
            selectedColor === color ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-muted"
          )}
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
          title={color}
        />
      ))}
    </div>
  );

  const renderStatusDialog = (isEdit: boolean) => (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-lg font-medium">{isEdit ? 'EDIT STAGE' : 'ADD STAGE'}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Name</FormLabel>
                <FormControl>
                  <Input placeholder={isEdit ? "" : "e.g. Confirmed, Completed, Delivered"} {...field} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Stage Color</FormLabel>
                <FormControl>
                  <div className="mt-2">{renderColorSwatches(field.onChange)}</div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between items-center pt-4">
            {isEdit && editingStatus && isProtectedStatus(editingStatus) && (
              <p className="text-sm text-muted-foreground">The "{editingStatus.name}" stage cannot be deleted.</p>
            )}

            {isEdit && editingStatus && !isProtectedStatus(editingStatus) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Session Stage</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{editingStatus?.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (editingStatus) {
                          handleDelete(editingStatus);
                          setIsEditDialogOpen(false);
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => (isEdit ? setIsEditDialogOpen(false) : setIsAddDialogOpen(false))}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {isEdit ? 'Saving...' : 'Adding...'}
                  </>
                ) : (
                  isEdit ? 'Save' : 'Add'
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );

  // Create default statuses if none exist
  if (!isLoading && activeOrganizationId && statuses.length === 0) {
    createDefaultStatuses();
  }

  if (isLoading) {
    return (
      <SettingsSection title={t('session_stages.title')} description={t('session_stages.description')}>
        <FormLoadingSkeleton rows={3} />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title={t('session_stages.title')}
      description={t('session_stages.description')}
      action={{ label: t('session_stages.add_stage'), onClick: handleAdd, icon: <Plus className="h-4 w-4" /> }}
    >
      {/* Mobile CTA */}
      <div className="mb-4 md:hidden">
        <Button onClick={handleAdd} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          {t('session_stages.add_stage')}
        </Button>
      </div>

      <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
        <p className="text-sm text-muted-foreground leading-relaxed">{t('session_stages.drag_instructions')}</p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="session-statuses" direction="horizontal">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={cn(
                "flex flex-wrap gap-3 min-h-[48px] transition-colors rounded-lg p-2",
                snapshot.isDraggingOver && "bg-accent/20"
              )}
            >
              {statuses.map((status, index) => (
                <Draggable key={status.id} draggableId={status.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all select-none",
                        snapshot.isDragging ? "opacity-80 shadow-xl scale-105 z-50" : "hover:opacity-80 cursor-pointer",
                        !snapshot.isDragging && "hover:scale-[1.02]"
                      )}
                      style={{
                        backgroundColor: status.color + '20',
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
                        <GripVertical className="w-3 h-3 text-current opacity-60" />
                      </div>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                      <span
                        className="uppercase tracking-wide font-semibold cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handleEdit(status); }}
                      >
                        {status.name}
                      </span>
                      {status.lifecycle && status.lifecycle !== 'active' && (
                        <span className="text-xs opacity-60 font-normal capitalize">
                          · {t(`session_status.lifecycle.${status.lifecycle}`)}
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

      {/* Add Dialog */}
      <AddSessionStatusDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onStatusAdded={refetch}
      />

      {/* Edit Dialog */}
      <EditSessionStatusDialog
        status={editingStatus}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onStatusUpdated={refetch}
      />
    </SettingsSection>
  );
};

export default SessionStatusesSection;
