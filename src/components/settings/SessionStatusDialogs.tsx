import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface AddSessionStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusAdded: () => void;
}

type SessionLifecycle = "active" | "completed" | "cancelled";

type SessionStatusRecord = {
  id: string;
  name: string;
  color: string;
  lifecycle?: SessionLifecycle | null;
  sort_order?: number | null;
  is_system_required?: boolean | null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

export function AddSessionStatusDialog({ open, onOpenChange, onStatusAdded }: AddSessionStatusDialogProps) {
  const { t } = useTranslation('forms');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{ name: string; color: string; lifecycle: SessionLifecycle }>({
    name: "",
    color: "#3B82F6",
    lifecycle: "active",
  });

  // Smart default based on name (no "archived" for sessions)
  const getSmartLifecycleDefault = (name: string): SessionLifecycle => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("cancel")) return "cancelled";
    if (lowerName.includes("deliver") || lowerName.includes("complete")) return "completed";
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
    if (!status) return;
    if (!formData.name.trim()) {
      toast({
        title: t('common:errors.validation'),
        description: t('session_status.errors.name_required'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      // Get the next sort order
      const { data: existingStatuses } = await supabase
        .from('session_statuses')
        .select('sort_order')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingStatuses?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('session_statuses')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name.trim(),
          color: formData.color,
          lifecycle: formData.lifecycle,
          sort_order: nextSortOrder,
          is_system_initial: false
        });

      if (error) throw error;

      toast({
        title: t('success.created'),
        description: t('session_status.success.added')
      });

      setFormData({ name: "", color: "#3B82F6", lifecycle: "active" });
      onOpenChange(false);
      onStatusAdded();
    } catch (error: unknown) {
      toast({
        title: t('common:errors.save'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(formData.name.trim() || formData.color !== "#3B82F6" || formData.lifecycle !== "active");

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      setFormData({ name: "", color: "#3B82F6", lifecycle: "active" });
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      setFormData({ name: "", color: "#3B82F6", lifecycle: "active" });
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('common:buttons.cancel'),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('buttons.adding') : t('common:buttons.add'),
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
      title={t('session_status.add_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('session_status.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('session_status.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
          <p className="text-sm text-muted-foreground">{t('session_status.name_help')}</p>
        </div>

        <div className="space-y-3">
          <Label>{t('session_status.color_label')}</Label>
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
          <Label>{t('session_status.lifecycle.label')}</Label>
        <SegmentedControl
          size="md"
          value={formData.lifecycle}
          onValueChange={(value) =>
            setFormData(prev => ({ ...prev, lifecycle: value as typeof prev.lifecycle }))
          }
          options={[
            { value: "active", label: t('session_status.lifecycle.active') },
            { value: "completed", label: t('session_status.lifecycle.completed') },
            { value: "cancelled", label: t('session_status.lifecycle.cancelled') },
          ]}
          className="mt-2 w-full justify-between"
        />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{t('session_status.lifecycle.help.title')}</p>
            <ul className="space-y-1 ml-4">
              <li>• <strong>{t('session_status.lifecycle.active')}:</strong> {t('session_status.lifecycle.help.active')}</li>
              <li>• <strong>{t('session_status.lifecycle.completed')}:</strong> {t('session_status.lifecycle.help.completed')}</li>
              <li>• <strong>{t('session_status.lifecycle.cancelled')}:</strong> {t('session_status.lifecycle.help.cancelled')}</li>
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

interface EditSessionStatusDialogProps {
  status: SessionStatusRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated: () => void;
}

export function EditSessionStatusDialog({ status, open, onOpenChange, onStatusUpdated }: EditSessionStatusDialogProps) {
  const { t } = useTranslation('forms');
  const [loading, setLoading] = useState(false);
  const initializedForId = useRef<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; color: string; lifecycle: SessionLifecycle }>({
    name: "",
    color: "#3B82F6",
    lifecycle: "active",
  });

  useEffect(() => {
    if (!open) {
      initializedForId.current = null;
      return;
    }

    if (status && initializedForId.current !== status.id) {
      setFormData({
        name: status.name,
        color: status.color,
        lifecycle: status.lifecycle || "active",
      });
      initializedForId.current = status.id;
    }
  }, [status, open]);

  const handleSubmit = async () => {
    if (!status) return;
    if (!formData.name.trim()) {
      toast({
        title: t('common:errors.validation'),
        description: t('session_status.errors.name_required'),
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
        title: t('success.updated'),
        description: t('session_status.success.updated')
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error: unknown) {
      toast({
        title: t('common:errors.save'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = status ? Boolean(
    formData.name !== status.name ||
    formData.color !== status.color ||
    formData.lifecycle !== (status.lifecycle || "active")
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

  if (!status) return null;

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!status) return;
    
    // Check if it's a system required status
    if (status.is_system_required) {
      toast({
        title: t('common:errors.delete'),
        description: t('session_status.errors.cannot_delete'),
        variant: "destructive"
      });
      return;
    }
    
    if (!window.confirm(t('session_status.confirm.delete'))) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_statuses')
        .delete()
        .eq('id', status.id);

      if (error) throw error;

      toast({
        title: t('success.deleted'),
        description: t('session_status.success.deleted')
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error: unknown) {
      toast({
        title: t('common:errors.delete'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isSystemRequired = Boolean(status.is_system_required);

  const footerActions = [
    // Only show delete for non-system-required stages
    ...(!isSystemRequired ? [{
      label: t('common:buttons.delete'),
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: loading
    }] : []),
    {
      label: t('common:buttons.cancel'),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('buttons.saving') : t('common:buttons.save'),
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
      title={t('session_status.edit_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('session_status.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('session_status.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
          {isSystemRequired && (
            <p className="text-sm text-muted-foreground">
              {t('session_status.system_required_note')}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Label>{t('session_status.color_label')}</Label>
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
            <Label>{t('session_status.lifecycle.label')}</Label>
            <SegmentedControl
              size="md"
              value={formData.lifecycle}
              onValueChange={(value) =>
                setFormData(prev => ({ ...prev, lifecycle: value as typeof prev.lifecycle }))
              }
              options={[
                { value: "active", label: t('session_status.lifecycle.active') },
                { value: "completed", label: t('session_status.lifecycle.completed') },
                { value: "cancelled", label: t('session_status.lifecycle.cancelled') },
              ]}
              className="mt-2 w-full justify-between"
            />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t('session_status.lifecycle.help.title')}</p>
              <ul className="space-y-1 ml-4">
                <li>• <strong>{t('session_status.lifecycle.active')}:</strong> {t('session_status.lifecycle.help.active')}</li>
                <li>• <strong>{t('session_status.lifecycle.completed')}:</strong> {t('session_status.lifecycle.help.completed')}</li>
                <li>• <strong>{t('session_status.lifecycle.cancelled')}:</strong> {t('session_status.lifecycle.help.cancelled')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Show info for system required stages */}
        {isSystemRequired && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{t('session_status.lifecycle.active')}:</strong> {t('session_status.system_required_info')}
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
