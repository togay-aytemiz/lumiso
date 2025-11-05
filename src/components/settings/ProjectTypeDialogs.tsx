import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";

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

interface AddProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeAdded: () => void;
}

export function AddProjectTypeDialog({ open, onOpenChange, onTypeAdded }: AddProjectTypeDialogProps) {
  const { t } = useTranslation('forms');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    is_default: false,
  });

  const handleSubmit = async () => {
    if (!type) return;

    if (!formData.name.trim()) {
      toast({
        title: t('common:errors.validation'),
        description: t('project_type.errors.name_required'),
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

      // If setting this as default, first unset all others
      if (formData.is_default) {
        await supabase
          .from('project_types')
          .update({ is_default: false })
          .eq('organization_id', organizationId);
      }

      // Get the next sort order
      const { data: existingTypes } = await supabase
        .from('project_types')
        .select('sort_order')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingTypes?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from('project_types')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name.trim(),
          sort_order: nextSortOrder,
          is_default: formData.is_default
        });

      if (error) throw error;

      toast({
        title: t('common:success.created'),
        description: t('project_type.success.added')
      });

      setFormData({ name: "", is_default: false });
      onOpenChange(false);
      onTypeAdded();
    } catch (error: unknown) {
      toast({
        title: t('common:errors.save'),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(formData.name.trim() || formData.is_default);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      setFormData({ name: "", is_default: false });
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      setFormData({ name: "", is_default: false });
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

  return (
    <AppSheetModal
      title={t('project_type.add_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('project_type.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('project_type.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
          <p className="text-sm text-muted-foreground">{t('project_type.name_help')}</p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="is_default"
            checked={formData.is_default}
            onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
            className="h-5 w-5 rounded border-2 border-input accent-primary focus:ring-2 focus:ring-primary/20 [&:checked]:text-white"
          />
          <div 
            className="cursor-pointer flex-1"
            onClick={() => setFormData(prev => ({ ...prev, is_default: !prev.is_default }))}
          >
            <Label htmlFor="is_default" className="text-sm font-medium cursor-pointer">{t('project_type.set_as_default')}</Label>
            <p className="text-sm text-muted-foreground cursor-pointer">{t('project_type.set_as_default_help')}</p>
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

interface ProjectType {
  id: string;
  name: string;
  is_default?: boolean;
  sort_order?: number;
}

interface EditProjectTypeDialogProps {
  type: ProjectType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeUpdated: () => void;
}

export function EditProjectTypeDialog({ type, open, onOpenChange, onTypeUpdated }: EditProjectTypeDialogProps) {
  const { t } = useTranslation('forms');
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
        title: t('common:errors.validation'),
        description: t('project_type.errors.name_required'),
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
      
      // If setting this as default, first unset all others
      if (formData.is_default && !type.is_default) {
        await supabase
          .from('project_types')
          .update({ is_default: false })
          .eq('organization_id', organizationId)
          .neq('id', type.id);
      }
      
      // Then update this type
      const { error } = await supabase
        .from('project_types')
        .update({
          name: formData.name.trim(),
          is_default: formData.is_default,
        })
        .eq('id', type.id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: t('common:success.updated'),
        description: t('project_type.success.updated')
      });

      onOpenChange(false);
      onTypeUpdated();
    } catch (error: unknown) {
      toast({
        title: t('common:errors.save'),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = type ? Boolean(formData.name !== type.name || formData.is_default !== (type.is_default || false)) : false;

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      if (type) {
        setFormData({
          name: type.name,
          is_default: type.is_default || false,
        });
      }
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  if (!type) return null;

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      setFormData({
        name: type.name,
        is_default: type.is_default || false,
      });
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!type) return;

    // Prevent deleting the default type
    if (type.is_default) {
      toast({
        title: t('common:errors.delete'),
        description: t('project_type.errors.cannot_delete_default'),
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm(t('project_type.confirm.delete'))) return;
    
    setLoading(true);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('project_types')
        .delete()
        .eq('id', type.id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: t('common:success.deleted'),
        description: t('project_type.success.deleted')
      });

      onOpenChange(false);
      onTypeUpdated();
    } catch (error: unknown) {
      toast({
        title: t('common:errors.delete'),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const footerActions = [
    {
      label: t('common:buttons.delete'),
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: loading
    },
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

  return (
    <AppSheetModal
      title={t('project_type.edit_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('project_type.name_label')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('project_type.name_placeholder')}
            maxLength={50}
            className="rounded-xl"
          />
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="is_default_edit"
            checked={formData.is_default}
            onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
            className="h-5 w-5 rounded border-2 border-input accent-primary focus:ring-2 focus:ring-primary/20 [&:checked]:text-white"
          />
          <div 
            className="cursor-pointer flex-1"
            onClick={() => setFormData(prev => ({ ...prev, is_default: !prev.is_default }))}
          >
            <Label htmlFor="is_default_edit" className="text-sm font-medium cursor-pointer">{t('project_type.set_as_default')}</Label>
            <p className="text-sm text-muted-foreground cursor-pointer">{t('project_type.set_as_default_help')}</p>
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
