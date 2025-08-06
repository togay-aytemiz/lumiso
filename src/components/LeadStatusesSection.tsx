import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, GripVertical, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import SettingsSection from "./SettingsSection";

const leadStatusSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1, "Color is required"),
});

type LeadStatusForm = z.infer<typeof leadStatusSchema>;

interface LeadStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const LeadStatusesSection = () => {
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadStatusForm>({
    resolver: zodResolver(leadStatusSchema),
    defaultValues: {
      name: "",
      color: "#6b7280",
    },
  });

  const watchedColor = watch("color");

  const fetchStatuses = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: existingStatuses } = await supabase
        .from("lead_statuses")
        .select("*")
        .eq("user_id", user.user.id)
        .order("sort_order");

      if (existingStatuses && existingStatuses.length > 0) {
        setStatuses(existingStatuses);
      } else {
        await createDefaultStatuses(user.user.id);
      }
    } catch (error) {
      console.error("Error fetching lead statuses:", error);
      toast.error("Failed to load lead statuses");
    } finally {
      setLoading(false);
    }
  };

  const createDefaultStatuses = async (userId: string) => {
    const defaultStatuses = [
      { name: "New", color: "#6b7280", sort_order: 1, is_default: true },
      { name: "Contacted", color: "#3b82f6", sort_order: 2, is_default: false },
      { name: "Qualified", color: "#10b981", sort_order: 3, is_default: false },
      { name: "Booked", color: "#8b5cf6", sort_order: 4, is_default: false },
      { name: "Not Interested", color: "#ef4444", sort_order: 5, is_default: false },
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
      toast.error("Failed to create default lead statuses");
    }
  };

  const onSubmit = async (data: LeadStatusForm) => {
    setSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Check for duplicate names (case-insensitive)
      const existingStatus = statuses.find(
        (status) =>
          status.name.toLowerCase() === data.name.toLowerCase() &&
          status.id !== editingStatus?.id
      );

      if (existingStatus) {
        toast.error("A status with this name already exists");
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
          .eq("user_id", user.user.id);

        if (error) throw error;

        setStatuses(prev =>
          prev.map(status =>
            status.id === editingStatus.id
              ? { ...status, name: data.name, color: data.color }
              : status
          )
        );

        toast.success("Status updated successfully");
        setIsEditDialogOpen(false);
      } else {
        // Create new status
        const maxSortOrder = Math.max(...statuses.map(s => s.sort_order), 0);
        
        const { data: newStatus, error } = await supabase
          .from("lead_statuses")
          .insert({
            name: data.name,
            color: data.color,
            user_id: user.user.id,
            sort_order: maxSortOrder + 1,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;
        if (newStatus) {
          setStatuses(prev => [...prev, newStatus]);
          toast.success("Status created successfully");
        }
        setIsAddDialogOpen(false);
      }

      reset();
      setEditingStatus(null);
    } catch (error) {
      console.error("Error saving status:", error);
      toast.error("Failed to save status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (status: LeadStatus) => {
    setEditingStatus(status);
    setValue("name", status.name);
    setValue("color", status.color);
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingStatus(null);
    reset({ name: "", color: "#6b7280" });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (statusId: string) => {
    try {
      const statusToDelete = statuses.find(s => s.id === statusId);
      
      // Prevent deletion of the "New" status
      if (statusToDelete?.name.toLowerCase() === "new") {
        toast.error("The 'New' status cannot be deleted as it's required for new leads");
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Check if any leads are using this status
      const { data: leadsWithStatus } = await supabase
        .from("leads")
        .select("id")
        .eq("status_id", statusId)
        .eq("user_id", user.user.id);

      if (leadsWithStatus && leadsWithStatus.length > 0) {
        toast.error(`Cannot delete status. ${leadsWithStatus.length} lead(s) are using this status.`);
        return;
      }

      const { error } = await supabase
        .from("lead_statuses")
        .delete()
        .eq("id", statusId)
        .eq("user_id", user.user.id);

      if (error) throw error;

      setStatuses(prev => prev.filter(status => status.id !== statusId));
      toast.success("Status deleted successfully");
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error deleting status:", error);
      toast.error("Failed to delete status");
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(statuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update sort_order based on new positions
    const updatedItems = items.map((item, index) => ({
      ...item,
      sort_order: index + 1,
    }));

    setStatuses(updatedItems);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Update sort_order in database
      const updates = updatedItems.map(item => ({
        id: item.id,
        sort_order: item.sort_order,
      }));

      for (const update of updates) {
        await supabase
          .from("lead_statuses")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id)
          .eq("user_id", user.user.id);
      }

      toast.success("Status order updated");
    } catch (error) {
      console.error("Error updating status order:", error);
      toast.error("Failed to update status order");
      fetchStatuses(); // Revert on error
    }
  };

  const renderStatusDialog = () => (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {editingStatus ? "Edit Status" : "Add Status"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Status Name</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="Enter status name"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="color"
              type="color"
              {...register("color")}
              className="w-16 h-10 p-1 border rounded"
            />
            <div
              className="w-10 h-10 rounded border flex-shrink-0"
              style={{ backgroundColor: watchedColor }}
            />
            <Input
              type="text"
              {...register("color")}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
          {errors.color && (
            <p className="text-sm text-destructive">{errors.color.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-4">
          <div>
            {editingStatus && editingStatus.name.toLowerCase() !== "new" && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(editingStatus.id)}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setIsEditDialogOpen(false);
                reset();
                setEditingStatus(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>
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
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Lead Statuses"
      description="Add, rename and reorder statuses to customize your lead workflow."
      action={{
        label: "Add Status",
        onClick: handleAdd,
        icon: <Plus className="w-4 h-4" />,
      }}
    >
      <div className="space-y-4">
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Lead statuses</strong> help you track progress through your sales pipeline.
              </p>
              <p>
                You can <strong>drag and drop</strong> to reorder statuses, and click any status to edit it.
                The "New" status is required and cannot be deleted.
              </p>
            </div>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="lead-statuses">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {statuses.map((status, index) => (
                  <Draggable key={status.id} draggableId={status.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 p-3 bg-background border rounded-lg transition-shadow ${
                          snapshot.isDragging ? "shadow-lg" : "hover:shadow-sm"
                        }`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <button
                          onClick={() => handleEdit(status)}
                          className="flex items-center gap-2 flex-1 text-left hover:bg-accent/50 rounded px-2 py-1 transition-colors"
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="text-sm font-medium">{status.name}</span>
                        </button>
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

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <div style={{ display: "none" }} />
        </DialogTrigger>
        {renderStatusDialog()}
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogTrigger asChild>
          <div style={{ display: "none" }} />
        </DialogTrigger>
        {renderStatusDialog()}
      </Dialog>
    </SettingsSection>
  );
};

export default LeadStatusesSection;