import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AddSessionStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusAdded: () => void;
}

export function AddSessionStatusDialog({ open, onOpenChange, onStatusAdded }: AddSessionStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    lifecycle: "active" as "active" | "completed" | "cancelled" | "archived",
  });

  // Smart default based on name
  const getSmartLifecycleDefault = (name: string): "active" | "completed" | "cancelled" | "archived" => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("cancel")) return "cancelled";
    if (lowerName.includes("deliver") || lowerName.includes("complete")) return "completed";
    if (lowerName.includes("archive")) return "archived";
    return "active";
  };

  // Update lifecycle when name changes
  useEffect(() => {
    if (formData.name) {
      const suggestedLifecycle = getSmartLifecycleDefault(formData.name);
      if (suggestedLifecycle !== formData.lifecycle) {
        setFormData(prev => ({ ...prev, lifecycle: suggestedLifecycle }));
      }
    }
  }, [formData.name]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Status name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error("Organization required");
      }

      // Get the next sort order
      const { data: existingStatuses } = await supabase
        .from('session_statuses')
        .select('sort_order')
        .eq('organization_id', userSettings.active_organization_id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingStatuses?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('session_statuses')
        .insert({
          user_id: user.id,
          organization_id: userSettings.active_organization_id,
          name: formData.name.trim(),
          color: formData.color,
          lifecycle: formData.lifecycle,
          sort_order: nextSortOrder,
          is_system_initial: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session stage added successfully"
      });

      setFormData({ name: "", color: "#3B82F6", lifecycle: "active" });
      onOpenChange(false);
      onStatusAdded();
    } catch (error: any) {
      toast({
        title: "Error adding session stage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(formData.name.trim() || formData.color !== "#3B82F6" || formData.lifecycle !== "active");

  const handleDirtyClose = () => {
    if (window.confirm("Are you sure you want to discard your changes? Any unsaved information will be lost.")) {
      setFormData({ name: "", color: "#3B82F6", lifecycle: "active" });
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Adding..." : "Add",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  const colorOptions = [
    "#EF4444", "#F97316", "#EAB308", "#84CC16", "#22C55E", "#06B6D4",
    "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#EC4899", "#64748B"
  ];

  return (
    <AppSheetModal
      title="ADD STAGE"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Confirmed, Completed, Delivered"
            maxLength={50}
            className="rounded-xl"
          />
          <p className="text-sm text-muted-foreground">Add, rename and reorder session stages.</p>
        </div>

        <div className="space-y-3">
          <Label>Stage Color</Label>
          <div className="grid grid-cols-6 gap-3 p-4">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, color }))}
                className={`w-10 h-10 rounded-full border-4 transition-all ${
                  formData.color === color 
                    ? 'border-gray-900 scale-110' 
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Lifecycle</Label>
          <div className="grid grid-cols-4 gap-2 p-1 bg-muted rounded-lg">
            {(["active", "completed", "cancelled", "archived"] as const).map((lifecycle) => (
              <button
                key={lifecycle}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, lifecycle }))}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-all capitalize",
                  formData.lifecycle === lifecycle
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {lifecycle}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Lifecycle drives automations and reporting.</p>
        </div>
      </div>
    </AppSheetModal>
  );
}

interface EditSessionStatusDialogProps {
  status: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated: () => void;
}

export function EditSessionStatusDialog({ status, open, onOpenChange, onStatusUpdated }: EditSessionStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    lifecycle: "active" as "active" | "completed" | "cancelled" | "archived",
  });

  useEffect(() => {
    if (status && open) {
      setFormData({
        name: status.name,
        color: status.color,
        lifecycle: status.lifecycle || "active",
      });
    }
  }, [status, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Status name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_statuses')
        .update({
          name: formData.name.trim(),
          color: formData.color,
          lifecycle: formData.lifecycle,
        })
        .eq('id', status.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session stage updated successfully"
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating session stage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!status) return null;

  const isDirty = Boolean(
    formData.name !== status.name ||
    formData.color !== status.color ||
    formData.lifecycle !== (status.lifecycle || "active")
  );

  const handleDirtyClose = () => {
    if (window.confirm("Are you sure you want to discard your changes? Any unsaved information will be lost.")) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this stage?")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_statuses')
        .delete()
        .eq('id', status.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session stage deleted successfully"
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error: any) {
      toast({
        title: "Error deleting session stage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isProtectedStatus = status.is_system_initial || 
    status.name?.toLowerCase().includes('completed') || 
    status.name?.toLowerCase().includes('cancelled');

  const footerActions = [
    {
      label: "Delete",
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: loading || isProtectedStatus
    },
    {
      label: "Cancel",
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Saving..." : "Save",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  const colorOptions = [
    "#EF4444", "#F97316", "#EAB308", "#84CC16", "#22C55E", "#06B6D4",
    "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#EC4899", "#64748B"
  ];

  return (
    <AppSheetModal
      title="EDIT STAGE"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Confirmed, Completed"
            maxLength={50}
            disabled={isProtectedStatus}
            className="rounded-xl"
          />
           {isProtectedStatus && (
             <p className="text-sm text-muted-foreground">System stages cannot be renamed or change color but can be edited for text changes.</p>
           )}
        </div>

          <div className="space-y-3">
            <Label>Stage Color</Label>
            <div className="grid grid-cols-6 gap-3 p-4">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                 onClick={() => !isProtectedStatus && setFormData(prev => ({ ...prev, color }))}
                 className={`w-10 h-10 rounded-full border-4 transition-all ${
                   formData.color === color 
                     ? 'border-gray-900 scale-110' 
                     : 'border-transparent hover:scale-105'
                 } ${isProtectedStatus ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Lifecycle</Label>
          <div className="grid grid-cols-4 gap-2 p-1 bg-muted rounded-lg">
            {(["active", "completed", "cancelled", "archived"] as const).map((lifecycle) => (
              <button
                key={lifecycle}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, lifecycle }))}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-all capitalize",
                  formData.lifecycle === lifecycle
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {lifecycle}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Lifecycle drives automations and reporting.</p>
        </div>

        {isProtectedStatus && (
          <div className="text-sm text-muted-foreground">
            System stages cannot be deleted as they are required for session management.
          </div>
        )}
      </div>
    </AppSheetModal>
  );
}