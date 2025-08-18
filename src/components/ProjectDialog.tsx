import { useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ProjectTypeSelector } from "./ProjectTypeSelector";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onProjectCreated: () => void;
}

export function ProjectDialog({ open, onOpenChange, leadId, onProjectCreated }: ProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setProjectTypeId("");
    setBasePrice("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required.",
        variant: "destructive"
      });
      return;
    }

    if (!projectTypeId) {
      toast({
        title: "Validation Error",
        description: "Please select a project type.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create a project.",
          variant: "destructive"
        });
        return;
      }

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        toast({
          title: "Organization required",
          description: "Please ensure you're part of an organization",
          variant: "destructive"
        });
        return;
      }

      // Get default project status
      const { data: defaultStatusId } = await supabase
        .rpc('get_default_project_status', { user_uuid: userData.user.id });

      const basePriceValue = parseFloat(basePrice) || 0;

      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          lead_id: leadId,
          user_id: userData.user.id,
          organization_id: userSettings.active_organization_id,
          status_id: defaultStatusId,
          project_type_id: projectTypeId,
          base_price: basePriceValue
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // Create base price payment if base price > 0
      if (basePriceValue > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            project_id: newProject.id,
            user_id: userData.user.id,
            amount: basePriceValue,
            description: 'Base Price',
            status: 'due',
            type: 'base_price'
          });

        if (paymentError) throw paymentError;
      }

      toast({
        title: "Success",
        description: "Project created successfully."
      });

      resetForm();
      onOpenChange(false);
      onProjectCreated();
    } catch (error: any) {
      toast({
        title: "Error creating project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = Boolean(name.trim() || description.trim() || projectTypeId || basePrice.trim());

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      resetForm();
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => {
        resetForm();
        onOpenChange(false);
      },
      variant: "outline" as const,
      disabled: isSaving
    },
    {
      label: isSaving ? "Creating..." : "Create Project",
      onClick: handleSave,
      disabled: isSaving || !name.trim() || !projectTypeId,
      loading: isSaving
    }
  ];

  return (
    <AppSheetModal
      title="ADD PROJECT"
      isOpen={open}
      onOpenChange={onOpenChange}
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name *</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter project name"
            disabled={isSaving}
            autoFocus
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="project-type">Project Type *</Label>
          <ProjectTypeSelector
            value={projectTypeId}
            onValueChange={setProjectTypeId}
            disabled={isSaving}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="base-price">Base Price (TRY)</Label>
          <Input
            id="base-price"
            type="number"
            step="1"
            min="0"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="0"
            disabled={isSaving}
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter project description (optional)"
            rows={4}
            disabled={isSaving}
            className="resize-none rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>
      </div>
    </AppSheetModal>
  );
}