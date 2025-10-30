import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import {
  LeadFieldDefinition,
  LeadFieldType,
  FIELD_TYPE_CONFIG,
  CreateLeadFieldDefinition,
} from "@/types/leadFields";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { useModalNavigation } from "@/hooks/useModalNavigation";

// System-reserved field keys that cannot be used for custom fields
const RESERVED_FIELD_KEYS = new Set([
  "name",
  "email",
  "phone",
  "status",
  "updated_at",
  "created_at",
  "assignees",
  "status_id",
  "due_date",
  "notes",
]);

const fieldSchema = z.object({
  label: z
    .string()
    .min(1, "Field label is required")
    .max(100, "Label is too long"),
  field_type: z.enum([
    "text",
    "textarea",
    "email",
    "phone",
    "date",
    "select",
    "checkbox",
    "number",
  ]),
  is_required: z.boolean().default(false),
  is_visible_in_form: z.boolean().default(true),
  options: z.string().optional(),
  allow_multiple: z.boolean().default(false),
  validation_rules: z
    .object({
      min_length: z.number().optional(),
      max_length: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional()
    .nullable(),
});

type FieldFormData = z.infer<typeof fieldSchema>;

interface LeadFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: LeadFieldDefinition | null;
  onClose: () => void;
}

export function LeadFieldDialog({
  open,
  onOpenChange,
  field,
  onClose,
}: LeadFieldDialogProps) {
  const { createFieldDefinition, updateFieldDefinition } =
    useLeadFieldDefinitions();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { t } = useTranslation(["forms", "common"]);

  const isEdit = !!field;
  const isSystemField = field?.is_system || false;

  const form = useForm<FieldFormData>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      label: "",
      field_type: "text",
      is_required: false,
      is_visible_in_form: true,
      options: "",
    },
  });

  // Track form dirty state
  const formValues = form.watch();
  useEffect(() => {
    const hasChanges = Object.keys(formValues).some((key) => {
      const currentValue = formValues[key as keyof typeof formValues];
      if (!field) return !!currentValue;

      switch (key) {
        case "label":
          return currentValue !== field.label;
        case "field_type":
          return currentValue !== field.field_type;
        case "is_required":
          return currentValue !== field.is_required;
        case "is_visible_in_form":
          return currentValue !== field.is_visible_in_form;
        case "options":
          const fieldOptions = field.options?.options?.join(", ") || "";
          return currentValue !== fieldOptions;
        default:
          return false;
      }
    });
    setIsDirty(hasChanges);
  }, [formValues, field]);

  const selectedFieldType = form.watch("field_type") as LeadFieldType;
  const fieldTypeConfig = FIELD_TYPE_CONFIG[selectedFieldType];

  const getInitialValues = useCallback((): FieldFormData => {
    if (field) {
      return {
        label: field.label,
        field_type: field.field_type as LeadFieldType,
        is_required: field.is_required,
        is_visible_in_form: field.is_visible_in_form,
        options: field.options?.options ? field.options.options.join(", ") : "",
        allow_multiple: field.allow_multiple || false,
        validation_rules: field.validation_rules as any,
      };
    }

    return {
      label: "",
      field_type: "text",
      is_required: false,
      is_visible_in_form: true,
      options: "",
      allow_multiple: false,
      validation_rules: undefined,
    };
  }, [field]);

  useEffect(() => {
    if (open) {
      form.reset(getInitialValues());
      setIsDirty(false);
    }
  }, [open, form, getInitialValues]);

  const onSubmit = async (data: FieldFormData) => {
    try {
      setLoading(true);

      const fieldKey = isEdit
        ? field.field_key
        : data.label.toLowerCase().replace(/[^a-z0-9]/g, "_");

      // Prevent collision with system-reserved keys
      if (!isEdit && RESERVED_FIELD_KEYS.has(fieldKey)) {
        toast.error(t("lead_field.reserved_key_error"), {
          description: t("lead_field.reserved_key_description", {
            key: fieldKey,
          }),
        });
        setLoading(false);
        return;
      }

      const fieldData: CreateLeadFieldDefinition = {
        field_key: fieldKey,
        label: data.label,
        field_type: data.field_type,
        is_required: data.is_required,
        is_visible_in_form: data.is_visible_in_form,
        options:
          fieldTypeConfig.supportsOptions && data.options
            ? {
                options: data.options
                  .split(",")
                  .map((opt) => opt.trim())
                  .filter(Boolean),
              }
            : undefined,
        validation_rules:
          fieldTypeConfig.supportsValidation && data.validation_rules
            ? data.validation_rules
            : undefined,
        allow_multiple:
          data.field_type === "select" ? data.allow_multiple : undefined,
      };

      if (isEdit) {
        await updateFieldDefinition(field.id, fieldData);
      } else {
        await createFieldDefinition(fieldData);
      }

      onClose();
    } catch (error) {
      console.error("Failed to save field:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = form.handleSubmit(onSubmit);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      form.reset(getInitialValues());
      setIsDirty(false);
      onClose();
    },
    onSaveAndExit: async () => {
      await handleSave();
    },
    message: t("lead_field.unsaved_changes"),
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      form.reset(getInitialValues());
      setIsDirty(false);
      onClose();
    }
  };

  const footerActions = [
    {
      label: t("buttons.cancel", { ns: "common" }),
      onClick: handleDirtyClose,
      variant: "outline" as const,
    },
    {
      label: loading
        ? t("lead_field.saving")
        : isEdit
        ? t("lead_field.update_field")
        : t("lead_field.create_field"),
      onClick: handleSave,
      loading,
      disabled: loading,
    },
  ];

  return (
    <AppSheetModal
      title={
        isEdit ? t("lead_field.edit_field") : t("lead_field.add_custom_field")
      }
      isOpen={open}
      onOpenChange={onOpenChange}
      size="lg"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-1 mb-6">
        <p className="text-sm text-muted-foreground">
          {isEdit
            ? t("lead_field.edit_description")
            : t("lead_field.create_description")}
        </p>
      </div>

      <Form {...form}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lead_field.field_label")} *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("lead_field.field_label_placeholder")}
                      {...field}
                      disabled={isSystemField}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("lead_field.field_label_description")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="field_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("lead_field.field_type")} *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSystemField}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("lead_field.select_field_type")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(FIELD_TYPE_CONFIG).map(([key]) => (
                        <SelectItem key={key} value={key}>
                          {t(`lead_field.field_types.${key}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t("lead_field.field_type_description")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {fieldTypeConfig.supportsOptions && (
            <>
              <FormField
                control={form.control}
                name="options"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lead_field.options")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("lead_field.options_placeholder")}
                        {...field}
                        disabled={isSystemField}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("lead_field.options_description")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedFieldType === "select" && (
                <FormField
                  control={form.control}
                  name="allow_multiple"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <FormLabel className="text-sm font-medium">
                          {t("lead_field.allow_multiple_selections")}
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          {t("lead_field.allow_multiple_description")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSystemField}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </>
          )}

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">
                {t("lead_field.field_settings")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("lead_field.field_settings_description")}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <FormField
                control={form.control}
                name="is_required"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSystemField}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal">
                      {t("lead_field.required")}
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_visible_in_form"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal">
                      {t("lead_field.visible_in_form")}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {isSystemField && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Badge variant="secondary">{t("lead_field.system_field")}</Badge>
              <p className="text-sm text-muted-foreground">
                {t("lead_field.system_field_description")}
              </p>
            </div>
          )}
        </div>
      </Form>
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
