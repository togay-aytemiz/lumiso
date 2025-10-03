import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";

interface AddLeadStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusAdded: () => void;
}

export function AddLeadStatusDialog({ open, onOpenChange, onStatusAdded }: AddLeadStatusDialogProps) {
  const { t } = useTranslation(['forms', 'common']);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    lifecycle: "active" as "active" | "completed" | "cancelled", // No "archived" for leads
  });

  // Smart default based on name (no "archived" for leads)
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
        title: t('errors.title', { defaultValue: 'Error' }),
        description: t('lead_status.errors.name_required'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      // Get the next sort order
      const { data: existingStatuses } = await supabase
        .from('lead_statuses')
        .select('sort_order')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingStatuses?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('lead_statuses')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name.trim(),
          color: formData.color,
          lifecycle: formData.lifecycle,
          sort_order: nextSortOrder,
          is_system_final: false,
          is_default: false
        });

      if (error) throw error;

      toast({
        title: t('success.created'),
        description: t('lead_status.success.added')
      });

      setFormData({ name: "", color: "#3B82F6", lifecycle: "active" });
      onOpenChange(false);
      onStatusAdded();
    } catch (error: any) {
      toast({
        title: t('lead_status.errors.add_failed'),
        description: error.message,
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
      label: t('buttons.cancel', { ns: 'common' }),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('lead_status.buttons.adding') : t('buttons.add', { ns: 'common' }),
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
      title={t('lead_status.add_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('lead_status.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('lead_status.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
          <p className="text-sm text-muted-foreground">{t('lead_status.name_help')}</p>
        </div>

      <div className="space-y-3">
        <Label>{t('lead_status.color_label')}</Label>
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
        <Label>{t('lead_status.lifecycle.label')}</Label>
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
              {t(`lead_status.lifecycle.${lifecycle}`)}
            </button>
          ))}
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{t('lead_status.lifecycle.help.title')}</p>
          <ul className="space-y-1 ml-4">
            <li>• <strong>{t('lead_status.lifecycle.active')}</strong>: {t('lead_status.lifecycle.help.active')}</li>
            <li>• <strong>{t('lead_status.lifecycle.completed')}</strong>: {t('lead_status.lifecycle.help.completed')}</li>
            <li>• <strong>{t('lead_status.lifecycle.cancelled')}</strong>: {t('lead_status.lifecycle.help.cancelled')}</li>
          </ul>
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
  const { t } = useTranslation(['forms', 'common']);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    lifecycle: "active" as "active" | "completed" | "cancelled", // No "archived" for leads
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
        title: t('errors.title', { defaultValue: 'Error' }),
        description: t('lead_status.errors.name_required'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('lead_statuses')
        .update({
          name: formData.name.trim(),
          color: formData.color,
          lifecycle: formData.lifecycle,
        })
        .eq('id', status.id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: t('success.updated'),
        description: t('lead_status.success.updated')
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error: any) {
      toast({
        title: t('lead_status.errors.update_failed'),
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
    if (window.confirm(t('lead_status.confirm.discard_changes'))) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!status) return;
    
    // Check if it's a system required status
    if (status.is_system_required) {
      toast({
        title: t('errors.title', { defaultValue: 'Cannot Delete' }),
        description: t('lead_status.errors.cannot_delete'),
        variant: "destructive"
      });
      return;
    }
    
    if (!window.confirm(t('lead_status.confirm.delete'))) return;
    
    setLoading(true);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', status.id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: t('success.deleted'),
        description: t('lead_status.success.deleted')
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error: any) {
      toast({
        title: t('lead_status.errors.delete_failed'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isSystemRequired = status.is_system_required;

  const footerActions = [
    // Only show delete for non-system-required statuses  
    ...(!isSystemRequired ? [{
      label: t('buttons.delete', { ns: 'common' }),
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: loading
    }] : []),
    {
      label: t('buttons.cancel', { ns: 'common' }),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('actions.saving', { ns: 'common' }) : t('buttons.save', { ns: 'common' }),
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
      title={t('lead_status.edit_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('lead_status.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('lead_status.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
          {isSystemRequired && (
            <p className="text-sm text-muted-foreground">
              {t('lead_status.system_required_note')}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Label>{t('lead_status.color_label')}</Label>
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

        {/* Only show lifecycle selector for non-system-required statuses */}
        {!isSystemRequired && (
          <div className="space-y-3">
            <Label>{t('lead_status.lifecycle.label')}</Label>
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
                  {t(`lead_status.lifecycle.${lifecycle}`)}
                </button>
              ))}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t('lead_status.lifecycle.help.title')}</p>
              <ul className="space-y-1 ml-4">
                <li>• <strong>{t('lead_status.lifecycle.active')}</strong>: {t('lead_status.lifecycle.help.active')}</li>
                <li>• <strong>{t('lead_status.lifecycle.completed')}</strong>: {t('lead_status.lifecycle.help.completed')}</li>
                <li>• <strong>{t('lead_status.lifecycle.cancelled')}</strong>: {t('lead_status.lifecycle.help.cancelled')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Show info for system required statuses */}
        {isSystemRequired && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              {t('lead_status.system_required_info')}
            </p>
          </div>
        )}
      </div>
    </AppSheetModal>
  );
}