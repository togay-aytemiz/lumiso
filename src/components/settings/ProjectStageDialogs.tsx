import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface AddProjectStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageAdded: () => void;
}

export function AddProjectStageDialog({ open, onOpenChange, onStageAdded }: AddProjectStageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#64748B",
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Stage name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the next sort order
      const { data: existingStages } = await supabase
        .from('project_statuses')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingStages?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('project_statuses')
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          color: formData.color,
          sort_order: nextSortOrder
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project stage added successfully"
      });

      setFormData({ name: "", color: "#64748B" });
      onOpenChange(false);
      onStageAdded();
    } catch (error: any) {
      toast({
        title: "Error adding project stage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(formData.name.trim() || formData.color !== "#64748B");

  const handleDirtyClose = () => {
    if (window.confirm("Are you sure you want to discard your changes? Any unsaved information will be lost.")) {
      setFormData({ name: "", color: "#64748B" });
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
            placeholder="e.g. Inquiry, Post Production, Completed"
            maxLength={50}
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
          <p className="text-sm text-muted-foreground">Organise your workflow in stages.</p>
        </div>

        <div className="space-y-3">
          <Label>Stage Color</Label>
          <div className="grid grid-cols-6 gap-3 p-2">
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
      </div>
    </AppSheetModal>
  );
}

interface EditProjectStageDialogProps {
  stage: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageUpdated: () => void;
}

export function EditProjectStageDialog({ stage, open, onOpenChange, onStageUpdated }: EditProjectStageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#EF4444",
  });

  useEffect(() => {
    if (stage && open) {
      setFormData({
        name: stage.name,
        color: stage.color,
      });
    }
  }, [stage, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Stage name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_statuses')
        .update({
          name: formData.name.trim(),
          color: formData.color,
        })
        .eq('id', stage.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project stage updated successfully"
      });

      onOpenChange(false);
      onStageUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating project stage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this stage?")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_statuses')
        .delete()
        .eq('id', stage.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project stage deleted successfully"
      });

      onOpenChange(false);
      onStageUpdated();
    } catch (error: any) {
      toast({
        title: "Error deleting project stage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!stage) return null;

  const isDirty = Boolean(
    formData.name !== stage.name ||
    formData.color !== stage.color
  );

  const handleDirtyClose = () => {
    if (window.confirm("Are you sure you want to discard your changes? Any unsaved information will be lost.")) {
      onOpenChange(false);
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
            placeholder="e.g., Planning, In Progress, Completed"
            maxLength={50}
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>

          <div className="space-y-3">
            <Label>Stage Color</Label>
            <div className="grid grid-cols-6 gap-3 p-2">
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
      </div>
    </AppSheetModal>
  );
}