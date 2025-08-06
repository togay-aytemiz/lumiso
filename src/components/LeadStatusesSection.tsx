import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SettingsSection from "./SettingsSection";

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

      const { data: existingStatuses } = await supabase
        .from("lead_statuses")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order");

      if (existingStatuses && existingStatuses.length > 0) {
        setStatuses(existingStatuses);
      } else {
        await createDefaultStatuses(user.id);
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

  const createDefaultStatuses = async (userId: string) => {
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

      // Check for duplicate names (case-insensitive)
      const existingStatus = statuses.find(
        (status) =>
          status.name.toLowerCase() === data.name.toLowerCase() &&
          status.id !== editingStatus?.id
      );

      if (existingStatus) {
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
        const { error } = await supabase
          .from("lead_statuses")
          .update({
            name: data.name,
            color: data.color,
          })
          .eq("id", editingStatus.id)
          .eq("user_id", user.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Status updated successfully",
        });
        setIsEditDialogOpen(false);
      } else {
        // Create new status
        const maxSortOrder = Math.max(...statuses.map(s => s.sort_order), 0);
        
        const { error } = await supabase
          .from("lead_statuses")
          .insert({
            name: data.name,
            color: data.color,
            user_id: user.id,
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

      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', statusId)
        .eq('user_id', user.id);

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
          
          <div className="flex justify-between items-center pt-4">
            {isEdit && editingStatus && editingStatus.name.toLowerCase() !== 'new' && (
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
            
            {isEdit && editingStatus && editingStatus.name.toLowerCase() === 'new' && (
              <p className="text-sm text-muted-foreground">
                The "New" status cannot be deleted as it's the default status for new leads.
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

  return (
    <>
      <SettingsSection 
        title="Lead Statuses" 
        description="Add, rename and reorder statuses to customize your lead workflow."
        action={{
          label: "Add Status",
          onClick: handleAdd,
          icon: <Plus className="h-4 w-4" />
        }}
      >
        <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Drag to reorder:</strong> Use the grip handle (⋮⋮) to drag statuses and change their order. 
            <strong>Click to edit:</strong> Click on any status to rename it or change its color. 
            The status order will be consistent across all lead views.
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

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            form.reset({ name: "", color: PREDEFINED_COLORS[0] });
            setEditingStatus(null);
          }
        }}>
          {renderStatusDialog(false)}
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            form.reset({ name: "", color: PREDEFINED_COLORS[0] });
            setEditingStatus(null);
          }
        }}>
          {renderStatusDialog(true)}
        </Dialog>
      </SettingsSection>
    </>
  );
};

export default LeadStatusesSection;