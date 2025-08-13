import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface AddLeadStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusAdded: () => void;
}

export function AddLeadStatusDialog({ open, onOpenChange, onStatusAdded }: AddLeadStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
  });

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

      // Get the next sort order
      const { data: existingStatuses } = await supabase
        .from('lead_statuses')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingStatuses?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('lead_statuses')
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          color: formData.color,
          sort_order: nextSortOrder,
          is_system_final: false,
          is_default: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead status added successfully"
      });

      setFormData({ name: "", color: "#3B82F6" });
      onOpenChange(false);
      onStatusAdded();
    } catch (error: any) {
      toast({
        title: "Error adding lead status",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(formData.name.trim() || formData.color !== "#3B82F6");

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      setFormData({ name: "", color: "#3B82F6" });
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
      label: loading ? "Adding..." : "Add Status",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Add Lead Status"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Status Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Interested, Follow Up"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex items-center gap-3">
            <Input
              id="color"
              type="color"
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-20 h-10 p-1 border rounded"
            />
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: formData.color, color: 'white' }}>
              {formData.name || "Preview"}
            </div>
          </div>
        </div>
      </div>
    </AppSheetModal>
  );
}

interface EditLeadStatusDialogProps {
  status: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated: () => void;
}

export function EditLeadStatusDialog({ status, open, onOpenChange, onStatusUpdated }: EditLeadStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
  });

  useEffect(() => {
    if (status && open) {
      setFormData({
        name: status.name,
        color: status.color,
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
        .from('lead_statuses')
        .update({
          name: formData.name.trim(),
          color: formData.color,
        })
        .eq('id', status.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead status updated successfully"
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating lead status",
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
    formData.color !== status.color
  );

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
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
      label: loading ? "Updating..." : "Update Status",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Edit Lead Status"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Status Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Interested, Follow Up"
            maxLength={50}
            disabled={status.is_system_final}
          />
          {status.is_system_final && (
            <p className="text-xs text-muted-foreground">System statuses cannot be renamed</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex items-center gap-3">
            <Input
              id="color"
              type="color"
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-20 h-10 p-1 border rounded"
            />
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: formData.color, color: 'white' }}>
              {formData.name || "Preview"}
            </div>
          </div>
        </div>
      </div>
    </AppSheetModal>
  );
}