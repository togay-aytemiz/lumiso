import { useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { SimpleProjectTypeSelect } from "./SimpleProjectTypeSelect";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { useTranslation } from "react-i18next";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onProjectCreated: () => void;
}

/**
 * @deprecated Legacy project creation modal. Use ProjectCreationWizardSheet for new flows.
 */
export function LegacyProjectDialog({ open, onOpenChange, leadId, onProjectCreated }: ProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation('forms');
  const { t: tForms } = useFormsTranslation();
  const toast = useI18nToast();

  const resetForm = () => {
    setName("");
    setDescription("");
    setProjectTypeId("");
    setBasePrice("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('validation.nameRequired'));
      return;
    }

    if (!projectTypeId) {
      toast.error(t('validation.typeRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error(t('messages.loginToCreateProject'));
        return;
      }

      // Get user's active organization
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        toast.error(t('messages.ensureOrganization'));
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
          organization_id: organizationId,
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
            organization_id: organizationId,
            amount: basePriceValue,
            description: t('payments.base_price'),
            status: 'due',
            type: 'base_price'
          });

        if (paymentError) throw paymentError;
      }

      toast.success(t('messages.projectCreated'));

      resetForm();
      onOpenChange(false);
      onProjectCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = Boolean(name.trim() || description.trim() || projectTypeId || basePrice.trim());

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      resetForm();
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSave();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      resetForm();
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('buttons.cancel'),
      onClick: () => {
        resetForm();
        onOpenChange(false);
      },
      variant: "outline" as const,
      disabled: isSaving
    },
    {
      label: isSaving ? t('buttons.creating') : t('buttons.createProject'),
      onClick: handleSave,
      disabled: isSaving || !name.trim() || !projectTypeId,
      loading: isSaving
    }
  ];

  return (
    <AppSheetModal
      title={t('dialogs.addProject')}
      isOpen={open}
      onOpenChange={onOpenChange}
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="project-name">{t('labels.projectName')} *</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholders.enterProjectName')}
            disabled={isSaving}
            autoFocus
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="project-type">{t('labels.projectType')} *</Label>
          <SimpleProjectTypeSelect
            value={projectTypeId}
            onValueChange={setProjectTypeId}
            disabled={isSaving}
            required
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="base-price">{t('labels.basePrice')}</Label>
          <Input
            id="base-price"
            type="number"
            step="1"
            min="0"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder={t('placeholders.basePrice')}
            disabled={isSaving}
            className="rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="project-description">{t('labels.description')}</Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('placeholders.enterProjectDescription')}
            rows={4}
            disabled={isSaving}
            className="resize-none rounded-xl border-2 border-primary/20 focus:border-primary"
          />
        </div>
      </div>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={t('dialogs.unsavedProjectChanges')}
      />
    </AppSheetModal>
  );
}

export { LegacyProjectDialog as ProjectDialog };
