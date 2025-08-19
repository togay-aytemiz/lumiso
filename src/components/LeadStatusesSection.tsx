import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SettingsSection from "./SettingsSection";
import { AddLeadStatusDialog, EditLeadStatusDialog } from "./settings/LeadStatusDialogs";
import { getUserOrganizationId } from "@/lib/organizationUtils";

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
}

// Predefined color palette (same as project statuses)
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
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(PREDEFINED_COLORS[0]);
  
  // User settings state
  const [settings, setSettings] = useState({
    show_quick_status_buttons: true
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const form = useForm<LeadStatusForm>({
    resolver: zodResolver(leadStatusSchema),
    defaultValues: {
      name: "",
      color: PREDEFINED_COLORS[0],
    },
  });

  const fetchStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Ensure system statuses exist first (this will only create them if they don't exist)
      await supabase.rpc('ensure_system_lead_statuses', {
        user_uuid: user.id
      });

      // Fetch all statuses for the organization
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error('No organization found');
      }

      const { data: existingStatuses } = await supabase
        .from("lead_statuses")
        .select("*")
        .eq("organization_id", organizationId)
        .order("sort_order");

      if (existingStatuses && existingStatuses.length > 0) {
        setStatuses(existingStatuses);
      } else {
        await createDefaultStatuses(user.id, organizationId);
      }
    } catch (error) {
      console.error("Error fetching lead statuses:", error);
      toast({
        title: "Error",
        description: "Failed to load lead statuses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('show_quick_status_buttons')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          show_quick_status_buttons: data.show_quick_status_buttons
        });
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load preferences",
        variant: "destructive"
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const updateSetting = async (key: keyof typeof settings, value: boolean) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userData.user.id,
          [key]: value
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));

      toast({
        title: "Success",
        description: "Preferences updated"
      });
    } catch (error: any) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const createDefaultStatuses = async (userId: string, organizationId: string) => {
    const defaultStatuses = [
      { name: "New", color: "#A0AEC0", sort_order: 1, is_default: true },
      { name: "Contacted", color: "#4299E1", sort_order: 2, is_default: false },
      { name: "Qualified", color: "#48BB78", sort_order: 3, is_default: false },
      { name: "Booked", color: "#9F7AEA", sort_order: 4, is_default: false },
      { name: "Not Interested", color: "#F56565", sort_order: 5, is_default: false },
    ];

    try {
      const { data, error } = await supabase
        .from("lead_statuses")
        .insert(
          defaultStatuses.map(status => ({
            ...status,
            user_id: userId,
            organization_id: organizationId,
          }))
        )
        .select();

      if (error) throw error;
      if (data) setStatuses(data);
    } catch (error) {
      console.error("Error creating default statuses:", error);
      toast({
        title: "Error",
        description: "Failed to create default lead statuses",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: LeadStatusForm) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // For system statuses, only check duplicates against other system statuses
      // For regular statuses, check against all statuses
      const isDuplicateSystemStatus = editingStatus?.is_system_final && 
        statuses.find(
          (status) =>
            status.name.toLowerCase() === data.name.toLowerCase() &&
            status.id !== editingStatus?.id &&
            status.is_system_final
        );

      const isDuplicateRegularStatus = !editingStatus?.is_system_final &&
        statuses.find(
          (status) =>
            status.name.toLowerCase() === data.name.toLowerCase() &&
            status.id !== editingStatus?.id
        );

      if (isDuplicateSystemStatus || isDuplicateRegularStatus) {
        toast({
          title: "Error",
          description: "A status with this name already exists",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (editingStatus) {
        // Update existing status
        const organizationId = await getUserOrganizationId();
        if (!organizationId) throw new Error('No organization found');

        const updateData: any = {
          name: data.name,
        };
        
        // For system statuses, preserve the original color to maintain consistency
        if (!editingStatus.is_system_final) {
          updateData.color = data.color;
        } else {
          // Ensure system status colors remain consistent with their purpose
          updateData.color = editingStatus.color;
        }
        
        const { error } = await supabase
          .from("lead_statuses")
          .update(updateData)
          .eq("id", editingStatus.id)
          .eq("organization_id", organizationId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Status updated successfully",
        });
        setIsEditDialogOpen(false);
      } else {
        // Create new status
        const maxSortOrder = Math.max(...statuses.map(s => s.sort_order), 0);
        const organizationId = await getUserOrganizationId();
        if (!organizationId) throw new Error('No organization found');
        
        const { error } = await supabase
          .from("lead_statuses")
          .insert({
            name: data.name,
            color: data.color,
            user_id: user.id,
            organization_id: organizationId,
            sort_order: maxSortOrder + 1,
            is_default: false,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Status created successfully",
        });
        setIsAddDialogOpen(false);
      }

      fetchStatuses();
      form.reset({ name: "", color: PREDEFINED_COLORS[0] });
      setEditingStatus(null);
    } catch (error) {
      console.error("Error saving status:", error);
      toast({
        title: "Error",
        description: "Failed to save status",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (status: LeadStatus) => {
    setEditingStatus(status);
    setSelectedColor(status.color);
    // For system statuses, only set the name since color can't be changed
    if (status.is_system_final) {
      form.reset({ name: status.name, color: status.color });
    } else {
      form.reset({ name: status.name, color: status.color });
    }
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
        if (error.code === '23503') { // Foreign key constraint violation
          throw new Error('Cannot delete this status because it is being used by existing leads. Please change those leads to a different status first.');
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Lead status deleted successfully",
      });
      fetchStatuses();
    } catch (error) {
      console.error('Error deleting lead status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete lead status",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(statuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for responsive UI
    setStatuses(items);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update sort_order for all items
      const updates = items.map((status, index) => ({
        id: status.id,
        sort_order: index + 1,
      }));

      // Execute all updates
      for (const update of updates) {
        const organizationId = await getUserOrganizationId();
        if (!organizationId) throw new Error('No organization found');

        const { error } = await supabase
          .from('lead_statuses')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
          .eq('organization_id', organizationId);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Status order updated successfully",
      });
    } catch (error) {
      console.error('Error updating status order:', error);
      toast({
        title: "Error",
        description: "Failed to update status order",
        variant: "destructive",
      });
      // Revert to original order on error
      fetchStatuses();
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
          onClick={() => {
            setSelectedColor(color);
            onColorSelect(color);
          }}
          title={color}
        />
      ))}
    </div>
  );

  const renderStatusDialog = (isEdit: boolean) => (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-lg font-medium">
          {isEdit ? 'EDIT STATUS' : 'ADD STATUS'}
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
                    placeholder={isEdit ? "" : "e.g. Qualified, Proposal Sent, Won"} 
                    {...field} 
                    className="mt-1"
                  />
                </FormControl>
                <FormMessage />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Organise your lead workflow in statuses.
                  </p>
                )}
              </FormItem>
            )}
          />
          
          {/* Color picker - disabled for system statuses */}
          {(!editingStatus || !editingStatus.is_system_final) && (
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Status Color</FormLabel>
                  <FormControl>
                    <div className="mt-2">
                      {renderColorSwatches(field.onChange)}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {editingStatus && editingStatus.is_system_final && (
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">Status Color</FormLabel>
              <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  Color cannot be changed for system statuses. This ensures consistency with quick action buttons.
                </p>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center pt-4">
            {isEdit && editingStatus && !editingStatus.is_system_final && editingStatus.name.toLowerCase() !== 'new' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Lead Status</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{editingStatus?.name}"? This action cannot be undone.
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
            
            {isEdit && editingStatus && (editingStatus.name.toLowerCase() === 'new' || editingStatus.is_system_final) && (
              <p className="text-sm text-muted-foreground">
                {editingStatus.name.toLowerCase() === 'new' 
                  ? 'The "New" status cannot be deleted as it\'s the default status for new leads.'
                  : 'System statuses (Completed/Lost) cannot be deleted as they are required for lead management.'
                }
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

  useEffect(() => {
    fetchStatuses();
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <SettingsSection 
        title="Lead Statuses" 
        description="Add, rename and reorder statuses to customize your lead workflow."
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsSection>
    );
  }

  // Get system statuses for dynamic description
  const systemStatuses = statuses.filter(status => status.is_system_final);
  const systemStatusNames = systemStatuses.map(s => s.name).join(' and ');
  const dynamicDescription = systemStatusNames 
    ? `Used for quick actions like marking leads as ${systemStatusNames.toLowerCase()}.`
    : "Used for quick actions like marking leads as completed or lost.";

  // Filter out only non-system statuses for drag and drop
  const customStatuses = statuses.filter(status => !status.is_system_final);

  const handleCustomDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(customStatuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for responsive UI - only reorder custom statuses
    const newStatuses = [
      ...systemStatuses,
      ...items
    ];
    setStatuses(newStatuses);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update sort_order for custom statuses only
      const updates = items.map((status, index) => ({
        id: status.id,
        sort_order: systemStatuses.length + index + 1, // Start after system statuses
      }));

      // Execute all updates
      for (const update of updates) {
        const { error } = await supabase
          .from('lead_statuses')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Status order updated successfully",
      });
    } catch (error) {
      console.error('Error updating status order:', error);
      toast({
        title: "Error",
        description: "Failed to update status order",
        variant: "destructive",
      });
      // Revert to original order on error
      fetchStatuses();
    }
  };

  return (
    <>
      <SettingsSection 
        title="Lead Statuses" 
        description="Configure your lead workflow and system status preferences."
      >
        {/* Settings Toggle Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quick-status-buttons" className="text-base">
                Show quick system status buttons on lead details
              </Label>
              <p className="text-sm text-muted-foreground">
                {dynamicDescription}
              </p>
            </div>
            <Switch
              id="quick-status-buttons"
              checked={settings.show_quick_status_buttons}
              onCheckedChange={(checked) => updateSetting('show_quick_status_buttons', checked)}
              disabled={saving || settingsLoading}
            />
          </div>

          {/* System Statuses Section */}
          {settings.show_quick_status_buttons && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">System Statuses</h4>
              
              <div className="flex flex-wrap gap-3">
                {systemStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer hover:opacity-80 transition-all"
                    style={{ 
                      backgroundColor: status.color + '20',
                      color: status.color,
                      border: `1px solid ${status.color}40`
                    }}
                    onClick={() => handleEdit(status)}
                  >
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="uppercase tracking-wide font-semibold">
                      {status.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Statuses Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Custom Statuses</h4>
              <Button onClick={handleAdd} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Status
              </Button>
            </div>
            
            <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Drag (⋮⋮) to reorder • Click to edit status names and colors.
              </p>
            </div>

            <DragDropContext onDragEnd={handleCustomDragEnd}>
              <Droppable droppableId="custom-statuses" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                      "flex flex-wrap gap-3 min-h-[48px] transition-colors rounded-lg p-2",
                      snapshot.isDraggingOver && "bg-accent/20"
                    )}
                  >
                    {customStatuses.map((status, index) => (
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
                              className="uppercase tracking-wide font-semibold cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(status);
                              }}
                            >
                              {status.name}
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
          </div>
        </div>

        {/* Add Dialog */}
        <AddLeadStatusDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onStatusAdded={fetchStatuses}
        />

        {/* Edit Dialog */}
        <EditLeadStatusDialog
          status={editingStatus}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onStatusUpdated={fetchStatuses}
        />
      </SettingsSection>
    </>
  );
};

export default LeadStatusesSection;