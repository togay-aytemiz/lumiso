import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddProjectStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageAdded: () => void;
}

export function AddProjectStageDialog({ open, onOpenChange, onStageAdded }: AddProjectStageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#EF4444",
    lifecycle: "active" as "active" | "completed" | "cancelled", // No "archived" for projects
  });

  // Smart default based on name (no "archived" for projects)
  const getSmartLifecycleDefault = (name: string): "active" | "completed" | "cancelled" => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("cancel")) return "cancelled";
    if (lowerName.includes("complete") || lowerName.includes("deliver") || lowerName.includes("done")) return "completed";
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
        description: "Stage name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's organization ID
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const organizationId = await getUserOrganizationId();

      if (!organizationId) {
        throw new Error("Organization required");
      }

      // Get the next sort order
      const { data: existingStages } = await supabase
        .from('project_statuses')
        .select('sort_order')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingStages?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('project_statuses')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name.trim(),
          color: formData.color,
          lifecycle: formData.lifecycle,
          sort_order: nextSortOrder
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project stage added successfully"
      });

      setFormData({ name: "", color: "#EF4444", lifecycle: "active" });
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

  const isDirty = Boolean(formData.name.trim() || formData.color !== "#EF4444" || formData.lifecycle !== "active");

  const handleDirtyClose = () => {
    if (window.confirm("Are you sure you want to discard your changes? Any unsaved information will be lost.")) {
      setFormData({ name: "", color: "#EF4444", lifecycle: "active" });
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
            className="rounded-xl"
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

        <div className="space-y-3">
          <Label>Lifecycle</Label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-lg">
            {(["active", "completed", "cancelled"] as const).map((lifecycle) => (
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
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Lifecycle drives automations and reporting:</p>
            <ul className="space-y-1 ml-4">
              <li>• <strong>Active:</strong> Stage is in progress</li>
              <li>• <strong>Completed:</strong> Project successfully finished</li>
              <li>• <strong>Cancelled:</strong> Project stopped or cancelled</li>
            </ul>
          </div>
        </div>
      </div>
    </AppSheetModal>
  );
}

// Types for compatibility with ProjectStatusesSection
interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  lifecycle?: 'active' | 'completed' | 'cancelled';
  is_system_required?: boolean;
}

interface EditProjectStageDialogProps {
  stage: ProjectStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageUpdated: () => void;
}

export function EditProjectStageDialog({ stage, open, onOpenChange, onStageUpdated }: EditProjectStageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#EF4444",
    lifecycle: "active" as "active" | "completed" | "cancelled",
  });

  useEffect(() => {
    if (stage && open) {
      setFormData({
        name: stage.name,
        color: stage.color,
        lifecycle: stage.lifecycle || "active",
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
          lifecycle: formData.lifecycle,
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
    if (!stage) return;
    
    // Check if it's a system required stage
    if (stage.is_system_required) {
      toast({
        title: "Cannot Delete",
        description: "This stage is required and cannot be deleted. You may rename it.",
        variant: "destructive"
      });
      return;
    }
    
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

  const isSystemRequired = stage.is_system_required;
  const isDirty = Boolean(
    formData.name !== stage.name ||
    formData.color !== stage.color ||
    formData.lifecycle !== (stage.lifecycle || "active")
  );

  const handleDirtyClose = () => {
    if (window.confirm("Are you sure you want to discard your changes? Any unsaved information will be lost.")) {
      onOpenChange(false);
    }
  };

  const footerActions = [
    // Only show delete for non-system-required stages
    ...(!isSystemRequired ? [{
      label: "Delete",
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: loading
    }] : []),
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
            className="rounded-xl"
          />
          {isSystemRequired && (
            <p className="text-sm text-muted-foreground">
              This is a system-required stage for new projects.
            </p>
          )}
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

        {/* Only show lifecycle selector for non-system-required stages */}
        {!isSystemRequired && (
          <div className="space-y-3">
            <Label>Lifecycle</Label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-lg">
              {(["active", "completed", "cancelled"] as const).map((lifecycle) => (
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
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Lifecycle drives automations and reporting:</p>
              <ul className="space-y-1 ml-4">
                <li>• <strong>Active:</strong> Stage is in progress</li>
                <li>• <strong>Completed:</strong> Project successfully finished</li>
                <li>• <strong>Cancelled:</strong> Project stopped or cancelled</li>
              </ul>
            </div>
          </div>
        )}

        {/* Show info for system required stages */}
        {isSystemRequired && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>System Required Stage:</strong> This stage is essential for project workflows and must remain Active. You can rename it but cannot delete it or change its lifecycle.
            </p>
          </div>
        )}
      </div>
    </AppSheetModal>
  );
}