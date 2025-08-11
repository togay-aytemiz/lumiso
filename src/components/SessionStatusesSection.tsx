import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SettingsSection from "./SettingsSection";

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
  const [statuses, setStatuses] = useState<SessionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<SessionStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<SessionStatusForm>({
    resolver: zodResolver(sessionStatusSchema),
    defaultValues: { name: "", color: PREDEFINED_COLORS[0] },
  });

  const selectedColor = form.watch("color");

  const fetchStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('session_statuses')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        await createDefaultStatuses();
        return;
      }

      setStatuses(data);
    } catch (error) {
      console.error('Error fetching session statuses:', error);
      toast({ title: "Error", description: "Failed to load session statuses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const defaults = [
        { name: 'Planned', color: '#A0AEC0', sort_order: 1, is_system_initial: true },
        { name: 'Confirmed', color: '#9F7AEA', sort_order: 2, is_system_initial: false },
        { name: 'Completed', color: '#48BB78', sort_order: 3, is_system_initial: false },
        { name: 'Delivered', color: '#4299E1', sort_order: 4, is_system_initial: false },
        { name: 'Cancelled', color: '#F56565', sort_order: 5, is_system_initial: false },
      ];

      const { data, error } = await supabase
        .from('session_statuses')
        .insert(defaults.map((d) => ({ ...d, user_id: user.id })))
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStatuses(data as SessionStatus[]);
    } catch (error) {
      console.error('Error creating default session statuses:', error);
      toast({ title: "Error", description: "Failed to create default session statuses", variant: "destructive" });
    }
  };

  const onSubmit = async (data: SessionStatusForm) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingStatus) {
        const { error } = await supabase
          .from('session_statuses')
          .update({ name: data.name, color: data.color })
          .eq('id', editingStatus.id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: "Success", description: "Session stage updated" });
        setIsEditDialogOpen(false);
      } else {
        const maxSortOrder = Math.max(...statuses.map(s => s.sort_order), 0);
        const { error } = await supabase
          .from('session_statuses')
          .insert({ name: data.name, color: data.color, user_id: user.id, sort_order: maxSortOrder + 1, is_system_initial: false });
        if (error) throw error;
        toast({ title: "Success", description: "Session stage created" });
        setIsAddDialogOpen(false);
      }

      form.reset({ name: "", color: PREDEFINED_COLORS[0] });
      setEditingStatus(null);
      fetchStatuses();
    } catch (error: any) {
      console.error('Error saving session status:', error);
      toast({ title: "Error", description: error?.message || 'Failed to save session stage', variant: "destructive" });
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
      if (status.is_system_initial) {
        toast({ title: "Not allowed", description: 'The "Planned" stage cannot be deleted', variant: "destructive" });
        return;
      }
      const { error } = await supabase
        .from('session_statuses')
        .delete()
        .eq('id', status.id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: "Success", description: "Session stage deleted" });
      fetchStatuses();
    } catch (error: any) {
      console.error('Error deleting session status:', error);
      toast({ title: "Error", description: error?.message || 'Failed to delete session stage', variant: "destructive" });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    const items = Array.from(statuses);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setStatuses(items);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      for (let i = 0; i < items.length; i++) {
        const s = items[i];
        const { error } = await supabase
          .from('session_statuses')
          .update({ sort_order: i + 1 })
          .eq('id', s.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      toast({ title: "Success", description: "Stage order updated" });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: "Error", description: 'Failed to update order', variant: "destructive" });
      fetchStatuses();
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
            {isEdit && editingStatus && editingStatus.is_system_initial && (
              <p className="text-sm text-muted-foreground">The "Planned" stage cannot be deleted.</p>
            )}

            {isEdit && editingStatus && !editingStatus.is_system_initial && (
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

  useEffect(() => { fetchStatuses(); }, []);

  if (loading) {
    return (
      <SettingsSection title="Session Stages" description="Add, rename and reorder session stages.">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Session Stages"
      description="Add, rename and reorder session stages."
      action={{ label: "Add Stage", onClick: handleAdd, icon: <Plus className="h-4 w-4" /> }}
    >
      <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
        <p className="text-sm text-muted-foreground leading-relaxed">Drag (⋮⋮) to reorder • Click to edit stage names and colors.</p>
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
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            form.reset({ name: "", color: PREDEFINED_COLORS[0] });
            setEditingStatus(null);
          }
        }}
      >
        {renderStatusDialog(false)}
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            form.reset({ name: "", color: PREDEFINED_COLORS[0] });
            setEditingStatus(null);
          }
        }}
      >
        {renderStatusDialog(true)}
      </Dialog>
    </SettingsSection>
  );
};

export default SessionStatusesSection;
