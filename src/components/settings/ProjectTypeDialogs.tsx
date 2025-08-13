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
    is_default: false,
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
          is_default: formData.is_default
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project type added successfully"
      });

      setFormData({ name: "", is_default: false });
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

  const isDirty = Boolean(formData.name.trim() || formData.is_default);

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      setFormData({ name: "", is_default: false });
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

  return (
    <AppSheetModal
      title="ADD TYPE"
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
            placeholder="e.g. Corporate, Wedding, Portrait"
            maxLength={50}
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
          <p className="text-sm text-muted-foreground">Customize your project types to reflect the type of work you offer.</p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="is_default"
            checked={formData.is_default}
            onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
            className="h-5 w-5 rounded border-2 border-primary/20 text-primary focus:ring-primary"
          />
          <div>
            <Label htmlFor="is_default" className="text-sm font-medium">Set as default</Label>
            <p className="text-sm text-muted-foreground">This type will be pre-selected when creating new projects.</p>
          </div>
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
    is_default: false,
  });

  useEffect(() => {
    if (type && open) {
      setFormData({
        name: type.name,
        is_default: type.is_default || false,
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
          is_default: formData.is_default,
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

  const isDirty = Boolean(formData.name !== type.name || formData.is_default !== (type.is_default || false));

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this project type?")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_types')
        .delete()
        .eq('id', type.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project type deleted successfully"
      });

      onOpenChange(false);
      onTypeUpdated();
    } catch (error: any) {
      toast({
        title: "Error deleting project type",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const footerActions = [
    {
      label: "Delete",
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: loading
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

  return (
    <AppSheetModal
      title="EDIT TYPE"
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
            placeholder="e.g., Wedding, Portrait, Event"
            maxLength={50}
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="is_default"
            checked={formData.is_default}
            onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
            className="h-5 w-5 rounded border-2 border-primary/20 text-primary focus:ring-primary"
          />
          <div>
            <Label htmlFor="is_default" className="text-sm font-medium">Set as default</Label>
            <p className="text-sm text-muted-foreground">This type will be pre-selected when creating new projects.</p>
          </div>
        </div>
      </div>
    </AppSheetModal>
  );
}