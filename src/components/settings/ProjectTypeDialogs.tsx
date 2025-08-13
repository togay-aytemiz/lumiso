import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface AddProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeAdded: () => void;
}

export function AddProjectTypeDialog({ open, onOpenChange, onTypeAdded }: AddProjectTypeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Project type name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the next sort order
      const { data: existingTypes } = await supabase
        .from('project_types')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingTypes?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('project_types')
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          sort_order: nextSortOrder,
          is_default: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project type added successfully"
      });

      setFormData({ name: "" });
      onOpenChange(false);
      onTypeAdded();
    } catch (error: any) {
      toast({
        title: "Error adding project type",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(formData.name.trim());

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      setFormData({ name: "" });
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
      label: loading ? "Adding..." : "Add Type",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Add Project Type"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Type Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Wedding, Portrait, Event"
            maxLength={50}
          />
        </div>
      </div>
    </AppSheetModal>
  );
}

interface EditProjectTypeDialogProps {
  type: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeUpdated: () => void;
}

export function EditProjectTypeDialog({ type, open, onOpenChange, onTypeUpdated }: EditProjectTypeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
  });

  useEffect(() => {
    if (type && open) {
      setFormData({
        name: type.name,
      });
    }
  }, [type, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Type name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_types')
        .update({
          name: formData.name.trim(),
        })
        .eq('id', type.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project type updated successfully"
      });

      onOpenChange(false);
      onTypeUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating project type",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!type) return null;

  const isDirty = Boolean(formData.name !== type.name);

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
      label: loading ? "Updating..." : "Update Type",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Edit Project Type"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Type Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Wedding, Portrait, Event"
            maxLength={50}
          />
        </div>
      </div>
    </AppSheetModal>
  );
}