import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { LeadFieldDefinition } from "@/types/leadFields";
import type { Database } from "@/integrations/supabase/types";
import { useI18nToast } from "@/lib/toastHelpers";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { getUserOrganizationId } from "@/lib/organizationUtils";

const normalizeValueForComparison = (
  value: unknown,
  fieldType: LeadFieldDefinition["field_type"]
) => {
  if (fieldType === "checkbox") {
    return Boolean(value);
  }

  if (fieldType === "number") {
    if (value === "" || value === null || value === undefined) {
      return "";
    }
    const numeric =
      typeof value === "number" ? value : Number(value as number | string);
    return Number.isFinite(numeric) ? numeric : "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (item == null ? "" : String(item)))
      .sort()
      .join(",");
  }

  return value ?? "";
};

interface EnhancedEditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Database["public"]["Tables"]["leads"]["Row"] | null;
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
  type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
  type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];
  type LeadFormValues = Record<string, unknown>;

  const { t } = useTranslation('forms');
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { fieldValues, loading: valuesLoading, upsertFieldValues } = useLeadFieldValues(lead?.id || "");
  const toast = useI18nToast();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Create dynamic schema based on field definitions
  const schema = createDynamicLeadSchema(fieldDefinitions);
  
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const initialFormValuesRef = useRef<LeadFormValues>({});

  const getStringValue = useCallback((values: LeadFormValues, key: string): string | undefined => {
    const raw = values[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
    return undefined;
  }, []);

  const toNullableString = useCallback((value: unknown): string | null => {
    if (value === undefined || value === null) {
      return null;
    }
    if (value === "") {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    if (Array.isArray(value)) {
      return value.map((item) => (item == null ? "" : String(item))).join(",");
    }
    return String(value);
  }, []);

  const getFallbackValue = useCallback(
    (fieldKey: string) => {
      if (!lead) return "";

      switch (fieldKey) {
        case "name":
          return lead.name || "";
        case "email":
          return lead.email || "";
        case "phone":
          return lead.phone || "";
        case "notes":
          return lead.notes || "";
        case "status":
          return lead.status || "";
        default:
          return "";
      }
    },
    [lead]
  );

  const getInitialValueForField = useCallback(
    (field: LeadFieldDefinition) => {
      const existingValue = fieldValues.find(
        (fv) => fv.field_key === field.field_key
      )?.value;

      if (field.field_type === "checkbox") {
        if (existingValue != null) {
          return existingValue === "true";
        }
        return false;
      }

      if (field.field_type === "number") {
        if (existingValue != null && existingValue !== "") {
          const parsed = Number(existingValue);
          return Number.isFinite(parsed) ? parsed : "";
        }
        return "";
      }

      if (existingValue != null) {
        return existingValue;
      }

      return getFallbackValue(field.field_key);
    },
    [fieldValues, getFallbackValue]
  );

  const formValues = form.watch() as LeadFormValues;
  
  // Track form dirty state by comparing with original values
  useEffect(() => {
    if (!lead || valuesLoading || fieldsLoading) return;

    const hasChanges = fieldDefinitions.some((field) => {
      const fieldName = `field_${field.field_key}`;

      if (!(fieldName in formValues)) {
        return false;
      }

      const currentValue = normalizeValueForComparison(
        formValues[fieldName],
        field.field_type
      );
      const originalValue = normalizeValueForComparison(
        getInitialValueForField(field),
        field.field_type
      );

      return currentValue !== originalValue;
    });

    setIsDirty(hasChanges);
  }, [
    formValues,
    fieldDefinitions,
    getInitialValueForField,
    lead,
    valuesLoading,
    fieldsLoading,
  ]);

  // Load existing field values when dialog opens
  useEffect(() => {
    if (open && lead && !fieldsLoading && !valuesLoading) {
      const formData: LeadFormValues = {};
      
      fieldDefinitions.forEach((field) => {
        const fieldName = `field_${field.field_key}`;
        formData[fieldName] = getInitialValueForField(field);
      });
      
      form.reset(formData);
      initialFormValuesRef.current = { ...formData };
    }
  }, [
    open,
    lead,
    fieldsLoading,
    valuesLoading,
    fieldDefinitions,
    getInitialValueForField,
    form,
  ]);

  const onSubmit = async (data: LeadFormValues) => {
    if (!lead) return;

    try {
      setLoading(true);

      let statusId: string | null = null;
      const statusValue = getStringValue(data, 'field_status');

      if (statusValue) {
        const organizationId = await getUserOrganizationId();
        if (organizationId) {
          const { data: statusData } = await supabase
            .from<LeadStatusRow>('lead_statuses')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('name', statusValue)
            .maybeSingle();
          statusId = statusData?.id ?? null;
        }
      }

      const nameValue = getStringValue(data, 'field_name') ?? lead.name;
      const emailValue = getStringValue(data, 'field_email');
      const phoneValue = getStringValue(data, 'field_phone');
      const notesValue = getStringValue(data, 'field_notes');

      const { error: leadError } = await supabase
        .from<LeadRow>('leads')
        .update({
          name: nameValue,
          email: emailValue ?? null,
          phone: phoneValue ?? null,
          notes: notesValue ?? null,
          ...(statusId ? { status_id: statusId } : {}),
        })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      const fieldValuesData: Record<string, string | null> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key.startsWith('field_')) {
          const fieldKey = key.replace('field_', '');
          fieldValuesData[fieldKey] = toNullableString(value);
        }
      });

      await upsertFieldValues(lead.id, fieldValuesData);

      toast.success(t('leadDialog.successUpdated'));

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to update lead:', error);
      toast.error(error instanceof Error ? error.message : t('leadDialog.errorUpdated'));
    } finally {
      setLoading(false);
    }
  };

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      form.reset(initialFormValuesRef.current);
      onClose();
    },
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      form.reset(initialFormValuesRef.current);
      onClose();
    }
  };

  const footerActions = [
    {
      label: t('leadDialog.cancel'),
      onClick: handleDirtyClose,
      variant: "outline" as const,
    },
    {
      label: loading ? t('leadDialog.updating') : t('leadDialog.updateButton'),
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
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleDirtyClose();
          } else {
            onOpenChange(true);
          }
        }}
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
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleDirtyClose();
          } else {
            onOpenChange(true);
          }
        }}
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
