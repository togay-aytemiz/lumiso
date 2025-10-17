import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { AddProjectStageDialog, EditProjectStageDialog } from "./settings/ProjectStageDialogs";
import { useProjectStatuses } from "@/hooks/useOrganizationData";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";
import SettingsSection from "./SettingsSection";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";
import { useMessagesTranslation } from "@/hooks/useTypedTranslation";
// Permissions removed for single photographer mode

const projectStatusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be less than 50 characters"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code"),
});

type ProjectStatusForm = z.infer<typeof projectStatusSchema>;

interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
  lifecycle?: 'active' | 'completed' | 'cancelled';
  is_system_required?: boolean;
}

// Predefined color palette (similar to Pixieset)
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

const ProjectStatusesSection = () => {
  const [editingStatus, setEditingStatus] = useState<ProjectStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useI18nToast();
  const { t } = useTranslation("forms");
  const { t: tMessages } = useMessagesTranslation();
  const { activeOrganizationId } = useOrganization();

  const { data: statuses = [], isLoading, refetch } = useProjectStatuses();
  // Permissions removed for single photographer mode - always allow

  // Check for lifecycle completeness and show warnings
  useEffect(() => {
    if (statuses.length > 0 && !isLoading) {
      const hasCompleted = statuses.some(s => s.lifecycle === 'completed');
      const hasCancelled = statuses.some(s => s.lifecycle === 'cancelled');
      
      if (!hasCompleted || !hasCancelled) {
        const timeoutId = setTimeout(() => {
          toast.info("Add at least one Completed and one Cancelled stage to unlock full automations.");
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [statuses, isLoading, toast]);

  const form = useForm<ProjectStatusForm>({
    resolver: zodResolver(projectStatusSchema),
    defaultValues: {
      name: "",
      color: PREDEFINED_COLORS[0],
    },
  });

  const selectedColor = form.watch("color");

  const isProtectedName = (name: string) => {
    const n = name?.trim().toLowerCase();
    return n === 'planned' || n === 'new' || n === 'archived';
  };

  const createDefaultStatuses = async () => {
    if (!activeOrganizationId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Updated default statuses as requested
      const defaultStatuses = [
        { name: 'Planned', color: '#A0AEC0', sort_order: 1 },
        { name: 'Booked', color: '#ECC94B', sort_order: 2 },
        { name: 'Post Production', color: '#9F7AEA', sort_order: 3 },
        { name: 'Completed', color: '#48BB78', sort_order: 4 },
        { name: 'Cancelled', color: '#F56565', sort_order: 5 }
      ];

      const { error } = await supabase
        .from('project_statuses')
        .insert(defaultStatuses.map(status => ({ ...status, user_id: user.id, organization_id: activeOrganizationId })));

      if (error) throw error;
      await refetch();
    } catch (error) {
      console.error('Error creating default statuses:', error);
      toast.error("Failed to create default statuses");
    }
  };

  const onSubmit = async (data: ProjectStatusForm) => {
    setSubmitting(true);
    try {
      const lowerName = data.name.trim().toLowerCase();
      if (lowerName === 'archived') {
        toast.error('The "Archived" stage is managed automatically and cannot be created or renamed.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingStatus) {
        // Update existing status
        if (!activeOrganizationId) throw new Error('No organization found');

        const { error } = await supabase
          .from('project_statuses')
          .update({ name: data.name, color: data.color })
          .eq('id', editingStatus.id)
          .eq('organization_id', activeOrganizationId);

        if (error) throw error;

        toast.success("Project status updated successfully");
        setIsEditDialogOpen(false);
      } else {
        // Create new status with the next sort order
        const maxSortOrder = Math.max(...statuses.map(s => s.sort_order), 0);
        if (!activeOrganizationId) throw new Error('No organization found');
        
        const { error } = await supabase
          .from('project_statuses')
          .insert({
            name: data.name,
            color: data.color,
            user_id: user.id,
            organization_id: activeOrganizationId,
            sort_order: maxSortOrder + 1,
          });

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            throw new Error('A status with this name already exists');
          }
          throw error;
        }

        toast.success("Project status created successfully");
        setIsAddDialogOpen(false);
      }

      form.reset({ name: "", color: PREDEFINED_COLORS[0] });
      setEditingStatus(null);
      await refetch();
    } catch (error) {
      console.error('Error saving project status:', error);
      toast.error(error instanceof Error ? error.message : "Failed to save project status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (status: any) => {
    // Cast to proper type for dialog
    const typedStatus: ProjectStatus = {
      ...status,
      lifecycle: (status.lifecycle as 'active' | 'completed' | 'cancelled') || 'active'
    };
    setEditingStatus(typedStatus);
    form.reset({ name: status.name, color: status.color });
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingStatus(null);
    form.reset({ name: "", color: PREDEFINED_COLORS[0] });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (statusId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!activeOrganizationId) throw new Error('No organization found');

      const status = statuses.find(s => s.id === statusId);
      if (status && isProtectedName(status.name)) {
        toast.error(`The "${status.name}" stage cannot be deleted as it's the default stage for new projects.`);
        return;
      }

      const { error } = await supabase
        .from('project_statuses')
        .delete()
        .eq('id', statusId)
        .eq('organization_id', activeOrganizationId);

      if (error) {
        if (error.code === '23503') { // Foreign key constraint violation
          throw new Error('Cannot delete this stage because it is being used by existing projects. Please change those projects to a different stage first.');
        }
        throw error;
      }

      toast.success("Project status deleted successfully");
      await refetch();
    } catch (error) {
      console.error('Error deleting project status:', error);
      toast.error(error instanceof Error ? error.message : "Failed to delete project status");
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!activeOrganizationId) throw new Error('No organization found');

      // Filter out archived statuses for reordering
      const filteredStatuses = statuses.filter(status => status.lifecycle !== 'archived' && status.name.toLowerCase() !== 'archived');
      const items = Array.from(filteredStatuses);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      // Update sort_order for filtered items only
      const updates = items.map((status, index) => ({
        id: status.id,
        sort_order: index + 1,
      }));

      // Execute all updates
      for (const update of updates) {
        const { error } = await supabase
          .from('project_statuses')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
          .eq('organization_id', activeOrganizationId);

        if (error) throw error;
      }

      toast.success("Status order updated successfully");
      await refetch();
    } catch (error) {
      console.error('Error updating status order:', error);
      toast.error("Failed to update status order");
    }
  };

  const renderColorSwatches = (onColorSelect: (color: string) => void) => (
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
          onClick={() => onColorSelect(color)}
          title={color}
        />
      ))}
    </div>
  );

  const renderStatusDialog = (isEdit: boolean) => (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-lg font-medium">
          {isEdit ? 'EDIT STAGE' : 'ADD STAGE'}
        </DialogTitle>
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
                  <Input 
                    placeholder={isEdit ? "" : "e.g. Inquiry, Post Production, Completed"} 
                    {...field} 
                    className="mt-1"
                  />
                </FormControl>
                <FormMessage />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Organise your workflow in stages.
                  </p>
                )}
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
                  <div className="mt-2">
                    {renderColorSwatches(field.onChange)}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex justify-between items-center pt-4">
            {isEdit && editingStatus && !isProtectedName(editingStatus.name) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project Status</AlertDialogTitle>
                    <AlertDialogDescription>
                      {tMessages('confirm.deleteWithName', { name: editingStatus?.name })} {tMessages('confirm.cannotUndo')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (editingStatus) {
                          handleDelete(editingStatus.id);
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
            
            {isEdit && editingStatus && isProtectedName(editingStatus.name) && (
              <p className="text-sm text-muted-foreground">
                The "{editingStatus.name}" stage cannot be deleted as it's the default stage for new projects.
              </p>
            )}
            
            <div className="flex gap-2 ml-auto">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => isEdit ? setIsEditDialogOpen(false) : setIsAddDialogOpen(false)}
              >
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
      <SettingsSection 
        title={t('project_stages.title')}
        description={t('project_stages.description')}
      >
        <FormLoadingSkeleton rows={3} />
      </SettingsSection>
    );
  }

  // Always show project statuses in single photographer mode
  // if (!hasPermission('view_project_statuses')) {
  //   return null;
  // }

  const canManageProjectStatuses = true; // Always allow in single photographer mode

  return (
    <>
    <SettingsSection 
      title={t('project_stages.title')}
      description={t('project_stages.description')}
      action={canManageProjectStatuses ? {
        label: t('project_stages.add_stage'),
        onClick: handleAdd,
        icon: <Plus className="h-4 w-4" />
      } : undefined}
    >
      {/* Mobile CTA */}
      {canManageProjectStatuses && (
        <div className="mb-4 md:hidden">
          <Button onClick={handleAdd} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t('project_stages.add_stage')}
          </Button>
        </div>
      )}

      <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('project_stages.drag_instructions')}
        </p>
      </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="statuses" direction="horizontal">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={cn(
                  "flex flex-wrap gap-3 min-h-[48px] transition-colors rounded-lg p-2",
                  snapshot.isDraggingOver && "bg-accent/20"
                )}
              >
                {statuses.filter(status => status.lifecycle !== 'archived' && status.name.toLowerCase() !== 'archived').map((status, index) => (
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
                          ...provided.draggableProps.style
                        }}
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="flex items-center cursor-grab active:cursor-grabbing hover:opacity-70 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-3 h-3 text-current opacity-60" />
                        </div>
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: status.color }}
                        />
                         <span 
                           className={`uppercase tracking-wide font-semibold ${canManageProjectStatuses ? 'cursor-pointer' : 'cursor-default'}`}
                           onClick={canManageProjectStatuses ? (e) => {
                             e.stopPropagation();
                             handleEdit(status);
                           } : undefined}
                         >
                           {status.name}
                         </span>
                         {status.lifecycle && status.lifecycle !== 'active' && (
                           <span className="text-xs opacity-60 font-normal capitalize">
                             · {t(`project_stage.lifecycle.${status.lifecycle}`)}
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
        {canManageProjectStatuses && (
          <>
            <AddProjectStageDialog
              open={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
              onStageAdded={refetch}
            />

            {/* Edit Dialog */}
            <EditProjectStageDialog
              stage={editingStatus}
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
              onStageUpdated={refetch}
            />
          </>
        )}
      </SettingsSection>
    </>
  );
};

export default ProjectStatusesSection;
