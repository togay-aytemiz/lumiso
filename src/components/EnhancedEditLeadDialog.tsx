import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings } from "lucide-react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { useTranslation } from "react-i18next";
import {
  Form,
} from "@/components/ui/form";
import { DynamicLeadFormFields } from "./DynamicLeadFormFields";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { createDynamicLeadSchema } from "@/lib/leadFieldValidation";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  [key: string]: any;
}

interface EnhancedEditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EnhancedEditLeadDialog({
  open, 
  onOpenChange, 
  lead,
  onClose, 
  onSuccess 
}: EnhancedEditLeadDialogProps) {
  const { t } = useTranslation('forms');
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { fieldValues, loading: valuesLoading, upsertFieldValues } = useLeadFieldValues(lead?.id || "");
  const toast = useI18nToast();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Create dynamic schema based on field definitions
  const schema = createDynamicLeadSchema(fieldDefinitions);
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const formValues = form.watch();
  
  // Track form dirty state by comparing with original values
  useEffect(() => {
    if (!lead || valuesLoading) return;
    
    const hasChanges = Object.entries(formValues).some(([key, value]) => {
      if (!key.startsWith('field_')) return false;
      
      const fieldKey = key.replace('field_', '');
      const originalValue = fieldValues.find(fv => fv.field_key === fieldKey)?.value || '';
      
      // Handle different field types for comparison
      const currentValue = value === null || value === undefined ? '' : String(value);
      return currentValue !== originalValue;
    });
    
    setIsDirty(hasChanges);
  }, [formValues, fieldValues, lead, valuesLoading]);

  // Load existing field values when dialog opens
  useEffect(() => {
    if (open && lead && !fieldsLoading && !valuesLoading) {
      const formData: Record<string, any> = {};
      
      fieldDefinitions.forEach(field => {
        const fieldName = `field_${field.field_key}`;
        const existingValue = fieldValues.find(fv => fv.field_key === field.field_key);
        
        // Get fallback value from lead object for system fields
        const getFallbackValue = (fieldKey: string) => {
          switch (fieldKey) {
            case 'name': return lead.name || '';
            case 'email': return lead.email || '';
            case 'phone': return lead.phone || '';
            case 'notes': return lead.notes || '';
            case 'status': return lead.status || '';
            default: return '';
          }
        };

        switch (field.field_type) {
          case 'checkbox':
            formData[fieldName] = existingValue?.value === 'true';
            break;
          case 'number':
            formData[fieldName] = existingValue?.value ? Number(existingValue.value) : '';
            break;
          case 'select':
            formData[fieldName] = existingValue?.value || getFallbackValue(field.field_key);
            break;
          default:
            formData[fieldName] = existingValue?.value || getFallbackValue(field.field_key);
        }
      });
      
      form.reset(formData);
    }
  }, [open, lead, fieldsLoading, valuesLoading, fieldDefinitions, fieldValues, form]);

  const onSubmit = async (data: any) => {
    if (!lead) return;
    
    try {
      setLoading(true);
      console.log('📝 Form submission data:', data);

      // Get status_id if status field is provided
      let statusId = null;
      if (data.field_status) {
        const organizationId = await getUserOrganizationId();
        const { data: statusData } = await supabase
          .from('lead_statuses')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('name', data.field_status)
          .maybeSingle();
        statusId = statusData?.id;
      }

      // Update the main lead record
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          name: data.field_name || lead.name,
          email: data.field_email || null,
          phone: data.field_phone || null,
          notes: data.field_notes || null,
          ...(statusId && { status_id: statusId }),
        })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      // Extract field values from form data
      const fieldValuesData: Record<string, string | null> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key.startsWith('field_')) {
          const fieldKey = key.replace('field_', '');
          fieldValuesData[fieldKey] = value ? String(value) : null;
        }
      });

      // Save field values
      await upsertFieldValues(lead.id, fieldValuesData);

      toast.success(t('messages.leadUpdatedDesc'));

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to update lead:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update lead");
    } finally {
      setLoading(false);
    }
  };

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      onClose();
    },
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onClose();
    }
  };

  const footerActions = [
    {
      label: t('leadDialog.cancel'),
      onClick: onClose,
      variant: "outline" as const,
    },
    {
      label: loading ? t('buttons.updating') : t('leadDialog.updateButton'),
      onClick: form.handleSubmit(onSubmit),
      loading,
      disabled: loading || fieldsLoading || valuesLoading,
    }
  ];

  if (fieldsLoading || valuesLoading) {
    return (
      <AppSheetModal
        title={t('leadDialog.editTitle')}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="lg"
        footerActions={[]}
      >
        <FormLoadingSkeleton rows={4} />
      </AppSheetModal>
    );
  }

  return (
    <>
      <AppSheetModal
        title={t('leadDialog.editTitle')}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="lg"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-1 mb-6">
          <p className="text-sm text-muted-foreground">
            {t('dialogs.updateLeadInfo')}
          </p>
        </div>

        <Form {...form}>
          <DynamicLeadFormFields
            fieldDefinitions={fieldDefinitions}
            control={form.control}
            visibleOnly={true}
          />
        </Form>
      </AppSheetModal>
      
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        message={navigation.message}
      />
    </>
  );
}