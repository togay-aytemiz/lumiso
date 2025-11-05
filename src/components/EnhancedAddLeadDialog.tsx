import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useI18nToast } from "@/lib/toastHelpers";
// Assignee components removed - single user organization
import { useProfile } from "@/hooks/useProfile";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

interface EnhancedAddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess?: (lead: { id: string; name: string; email?: string | null; phone?: string | null }) => void;
}

export function EnhancedAddLeadDialog({ 
  open, 
  onOpenChange, 
  onClose, 
  onSuccess 
}: EnhancedAddLeadDialogProps) {
  type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];
  type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
  type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

  type LeadFormValues = Record<string, unknown>;

  const { t } = useTranslation('forms');
  const { t: tCommon } = useTranslation('common');
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { upsertFieldValues } = useLeadFieldValues("");
  const toast = useI18nToast();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // Assignees removed - single user organization

  // Create dynamic schema based on field definitions
  const schema = createDynamicLeadSchema(fieldDefinitions);
  
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const [defaultsReady, setDefaultsReady] = useState(false);
  const initialValuesRef = useRef<LeadFormValues>({});
  const watchedValues = form.watch() as LeadFormValues;

  const getStringValue = useCallback(
    (values: LeadFormValues, key: string): string | undefined => {
      const raw = values[key];
      if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.trim();
      }
      return undefined;
    },
    []
  );

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
      return value
        .map((item) => (item == null ? "" : String(item)))
        .join(",");
    }
    return String(value);
  }, []);

  useEffect(() => {
    if (open && !fieldsLoading) {
      setDefaultsReady(false);
      // Reset form when dialog opens
      const setDefaultValues = async () => {
        const defaultValues: LeadFormValues = {};

        // Get organization ID for status lookup
        const organizationId = await getUserOrganizationId();

        for (const field of fieldDefinitions) {
          const fieldName = `field_${field.field_key}`;

          if (field.field_key === "status" && organizationId) {
            try {
              const { data: defaultStatus } = await supabase
                .from<LeadStatusRow>("lead_statuses")
                .select("name")
                .eq("organization_id", organizationId)
                .eq("is_default", true)
                .maybeSingle();

              defaultValues[fieldName] = defaultStatus?.name ?? "New";
            } catch (error) {
              console.error("Error fetching default status:", error);
              defaultValues[fieldName] = "New";
            }
          } else {
            switch (field.field_type) {
              case "checkbox":
                defaultValues[fieldName] = false;
                break;
              case "number":
                defaultValues[fieldName] = "";
                break;
              default:
                defaultValues[fieldName] = "";
            }
          }
        }

        initialValuesRef.current = { ...defaultValues };
        form.reset(defaultValues);
        setDefaultsReady(true);
      };

      setDefaultValues();
    } else if (!open) {
      setDefaultsReady(false);
    }
  }, [open, fieldsLoading, fieldDefinitions, form]);

  const hasDirtyValue = useMemo(() => {
    if (!defaultsReady) {
      return false;
    }

    const initialValues = initialValuesRef.current ?? {};
    const currentValues = watchedValues ?? {};
    const keys = new Set<string>([
      ...Object.keys(initialValues),
      ...Object.keys(currentValues),
    ]);

    const isEmpty = (value: unknown) =>
      value === "" || value === null || typeof value === "undefined";

    const valuesEqual = (a: unknown, b: unknown): boolean => {
      if (a === b) {
        return true;
      }
      if (isEmpty(a) && isEmpty(b)) {
        return true;
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
          return false;
        }
        return a.every((item, index) => valuesEqual(item, b[index]));
      }
      if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
      }
      if (
        typeof a === "object" &&
        a !== null &&
        typeof b === "object" &&
        b !== null
      ) {
        try {
          return JSON.stringify(a) === JSON.stringify(b);
        } catch {
          return false;
        }
      }
      return false;
    };

    for (const key of keys) {
      if (key === "field_status") {
        continue;
      }
      if (!valuesEqual(initialValues[key], currentValues[key])) {
        return true;
      }
    }

    return false;
  }, [defaultsReady, watchedValues]);

  const onSubmit = async (data: LeadFormValues) => {
    try {
      setLoading(true);

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error(t('leadDialog.errorNoOrganization'));
      }

      const authResponse = await supabase.auth.getUser();
      const userId = authResponse.data.user?.id;
      if (!userId) {
        throw new Error(t('leadDialog.errorCreated'));
      }

      let statusName = getStringValue(data, 'field_status');
      let statusId: string | null = null;

      if (statusName) {
        const { data: statusData } = await supabase
          .from<LeadStatusRow>('lead_statuses')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('name', statusName)
          .maybeSingle();

        statusId = statusData?.id ?? null;
        statusName = statusData?.name ?? statusName;
      } else {
        const { data: defaultStatus } = await supabase
          .from<LeadStatusRow>('lead_statuses')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('is_default', true)
          .maybeSingle();

        statusId = defaultStatus?.id ?? null;
        statusName = defaultStatus?.name ?? 'New';
      }

      const leadInsert: LeadInsert = {
        organization_id: organizationId,
        user_id: userId,
        name: getStringValue(data, 'field_name') ?? 'Unnamed Lead',
        email: getStringValue(data, 'field_email') ?? null,
        phone: getStringValue(data, 'field_phone') ?? null,
        notes: getStringValue(data, 'field_notes') ?? null,
        status: statusName ?? 'New',
        status_id: statusId,
      };

      const { data: newLead, error: leadError } = await supabase
        .from<LeadRow>('leads')
        .insert(leadInsert)
        .select()
        .single();

      if (leadError || !newLead) throw leadError ?? new Error('Failed to create lead');

      const fieldValues: Record<string, string | null> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key.startsWith('field_')) {
          const fieldKey = key.replace('field_', '');
          fieldValues[fieldKey] = toNullableString(value);
        }
      });

      await upsertFieldValues(newLead.id, fieldValues);

      toast.success(
        <div className="space-y-2">
          <p>{t('leadDialog.successCreated')}</p>
          <button
            type="button"
            className="text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none"
            onClick={() => navigate(`/leads/${newLead.id}`)}
          >
            {tCommon('buttons.view_lead')}
          </button>
        </div>,
        {
          className: "flex-col items-start",
        }
      );

      onSuccess?.({
        id: newLead.id,
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create lead:', error);
      toast.error(error instanceof Error ? error.message : t('leadDialog.errorCreated'));
    } finally {
      setLoading(false);
    }
  };

  const navigation = useModalNavigation({
    isDirty: hasDirtyValue,
    onDiscard: () => {
      form.reset(initialValuesRef.current);
      onClose();
    },
    onSaveAndExit: async () => {
      await form.handleSubmit(onSubmit)();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      form.reset(initialValuesRef.current);
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
      label: loading ? t('leadDialog.creating') : t('leadDialog.createButton'),
      onClick: form.handleSubmit(onSubmit),
      loading,
      disabled: loading || fieldsLoading,
    }
  ];

  if (fieldsLoading || !defaultsReady) {
    return (
      <AppSheetModal
        title={t('leadDialog.addTitle')}
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
        title={t('leadDialog.addTitle')}
        isOpen={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleDirtyClose();
          } else {
            onOpenChange(true);
          }
        }}
        size="lg"
        dirty={hasDirtyValue}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-1 mb-6">
          <p className="text-sm text-muted-foreground">
            {t('leadDialog.addSubtitle')}
          </p>
        </div>

        <Form {...form}>
          <DynamicLeadFormFields
            fieldDefinitions={fieldDefinitions}
            control={form.control}
            visibleOnly={true}
          />
          
          {/* Assignees removed - single user organization */}
        </Form>
      </AppSheetModal>
      
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={t('dialogs.unsavedChanges')}
      />
    </>
  );
}
