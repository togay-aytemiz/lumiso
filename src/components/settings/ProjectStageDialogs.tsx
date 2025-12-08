import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";
import { SegmentedControl } from "@/components/ui/segmented-control";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "An unexpected error occurred";
};

interface AddProjectStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageAdded: () => void;
}

export function AddProjectStageDialog({ open, onOpenChange, onStageAdded }: AddProjectStageDialogProps) {
  const { t } = useTranslation('forms');
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
  }, [formData.name, formData.lifecycle]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t('errors.title', { defaultValue: 'Error' }),
        description: t('project_stage.errors.name_required'),
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
        title: t('success.created'),
        description: t('project_stage.success.added')
      });

      setFormData({ name: "", color: "#EF4444", lifecycle: "active" });
      onOpenChange(false);
      onStageAdded();
    } catch (error: unknown) {
      toast({
        title: t('project_stage.errors.add_failed'),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(formData.name.trim() || formData.color !== "#EF4444" || formData.lifecycle !== "active");

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      setFormData({ name: "", color: "#EF4444", lifecycle: "active" });
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      setFormData({ name: "", color: "#EF4444", lifecycle: "active" });
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('buttons.cancel'),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('buttons.adding') : t('buttons.add'),
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
      title={t('project_stage.add_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('project_stage.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('project_stage.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
          <p className="text-sm text-muted-foreground">{t('project_stage.name_help')}</p>
        </div>

        <div className="space-y-3">
          <Label>{t('project_stage.color_label')}</Label>
          <div className="grid grid-cols-6 gap-3 p-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, color }))}
                className={`w-10 h-10 shrink-0 rounded-full border-4 p-0 transition-all ${
                  formData.color === color 
                    ? 'border-gray-900 scale-110' 
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color, borderRadius: "9999px", minWidth: "2.5rem", minHeight: "2.5rem" }}
                data-touch-target="none"
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>{t('project_stage.lifecycle.label')}</Label>
        <SegmentedControl
          size="md"
          value={formData.lifecycle}
          onValueChange={(value) =>
            setFormData(prev => ({ ...prev, lifecycle: value as typeof prev.lifecycle }))
          }
          options={[
            { value: "active", label: t('project_stage.lifecycle.active') },
            { value: "completed", label: t('project_stage.lifecycle.completed') },
            { value: "cancelled", label: t('project_stage.lifecycle.cancelled') },
          ]}
          className="mt-2 w-full justify-between"
        />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{t('project_stage.lifecycle.help.title')}</p>
            <ul className="space-y-1 ml-4">
              <li>• <strong>{t('project_stage.lifecycle.active')}</strong>: {t('project_stage.lifecycle.help.active')}</li>
              <li>• <strong>{t('project_stage.lifecycle.completed')}</strong>: {t('project_stage.lifecycle.help.completed')}</li>
              <li>• <strong>{t('project_stage.lifecycle.cancelled')}</strong>: {t('project_stage.lifecycle.help.cancelled')}</li>
            </ul>
          </div>
        </div>
      </div>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={navigation.message}
      />
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
  const { t } = useTranslation('forms');
  const [loading, setLoading] = useState(false);
  const initializedForId = useRef<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#EF4444",
    lifecycle: "active" as "active" | "completed" | "cancelled",
  });

  useEffect(() => {
    if (!open) {
      initializedForId.current = null;
      return;
    }

    if (stage && initializedForId.current !== stage.id) {
      setFormData({
        name: stage.name,
        color: stage.color,
        lifecycle: stage.lifecycle || "active",
      });
      initializedForId.current = stage.id;
    }
  }, [stage, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t('errors.title', { defaultValue: 'Error' }),
        description: t('project_stage.errors.name_required'),
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
        title: t('success.updated'),
        description: t('project_stage.success.updated')
      });

      onOpenChange(false);
      onStageUpdated();
    } catch (error: unknown) {
      toast({
        title: t('project_stage.errors.update_failed'),
        description: getErrorMessage(error),
        variant: "destructive",
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
        title: t('errors.title', { defaultValue: 'Cannot Delete' }),
        description: t('project_stage.errors.cannot_delete'),
        variant: "destructive"
      });
      return;
    }
    
    if (!window.confirm(t('project_stage.confirm.delete'))) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_statuses')
        .delete()
        .eq('id', stage.id);

      if (error) throw error;

      toast({
        title: t('success.deleted'),
        description: t('project_stage.success.deleted')
      });

      onOpenChange(false);
      onStageUpdated();
    } catch (error: unknown) {
      toast({
        title: t('project_stage.errors.delete_failed'),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isSystemRequired = Boolean(stage?.is_system_required);
  const isDirty = stage ? Boolean(
    formData.name !== stage.name ||
    formData.color !== stage.color ||
    formData.lifecycle !== (stage.lifecycle || "active")
  ) : false;

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  if (!stage) return null;

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  const footerActions = [
    // Only show delete for non-system-required stages
    ...(!isSystemRequired ? [{
      label: t('buttons.delete'),
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: loading
    }] : []),
    {
      label: t('buttons.cancel'),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('buttons.saving') : t('buttons.save'),
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
      title={t('project_stage.edit_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
      footerInlineOnMobile
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('project_stage.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('project_stage.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
          {isSystemRequired && (
            <p className="text-sm text-muted-foreground">
              {t('project_stage.system_required_note')}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Label>{t('project_stage.color_label')}</Label>
          <div className="grid grid-cols-6 gap-3 p-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, color }))}
                className={`w-10 h-10 shrink-0 rounded-full border-4 p-0 transition-all ${
                  formData.color === color 
                    ? 'border-gray-900 scale-110' 
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color, borderRadius: "9999px", minWidth: "2.5rem", minHeight: "2.5rem" }}
                data-touch-target="none"
              />
            ))}
          </div>
        </div>

        {/* Only show lifecycle selector for non-system-required stages */}
        {!isSystemRequired && (
          <div className="space-y-3">
            <Label>{t('project_stage.lifecycle.label')}</Label>
            <SegmentedControl
              size="md"
              value={formData.lifecycle}
              onValueChange={(value) =>
                setFormData(prev => ({ ...prev, lifecycle: value as typeof prev.lifecycle }))
              }
              options={[
                { value: "active", label: t('project_stage.lifecycle.active') },
                { value: "completed", label: t('project_stage.lifecycle.completed') },
                { value: "cancelled", label: t('project_stage.lifecycle.cancelled') },
              ]}
              className="mt-2 w-full justify-between"
            />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t('project_stage.lifecycle.help.title')}</p>
              <ul className="space-y-1 ml-4">
                <li>• <strong>{t('project_stage.lifecycle.active')}</strong>: {t('project_stage.lifecycle.help.active')}</li>
                <li>• <strong>{t('project_stage.lifecycle.completed')}</strong>: {t('project_stage.lifecycle.help.completed')}</li>
                <li>• <strong>{t('project_stage.lifecycle.cancelled')}</strong>: {t('project_stage.lifecycle.help.cancelled')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Show info for system required stages */}
        {isSystemRequired && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              {t('project_stage.system_required_info')}
            </p>
          </div>
        )}
      </div>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={navigation.message}
      />
    </AppSheetModal>
  );
}
