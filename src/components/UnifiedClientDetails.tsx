import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Mail,
  MessageCircle,
  MessageSquare,
  ChevronDown,
  Pencil,
  AlertTriangle,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { useLeadUpdate } from "@/hooks/useLeadUpdate";
import { CustomFieldDisplay } from "@/components/fields/CustomFieldDisplay";
import { CustomFieldDisplayWithEmpty } from "@/components/fields/CustomFieldDisplayWithEmpty";
import { FieldTextareaDisplay } from "@/components/fields/FieldTextareaDisplay";
import { InlineEditField } from "@/components/fields/InlineEditField";
import { InlineTextEditor } from "@/components/fields/inline-editors/InlineTextEditor";
import { InlineTextareaEditor } from "@/components/fields/inline-editors/InlineTextareaEditor";
import { InlineEmailEditor } from "@/components/fields/inline-editors/InlineEmailEditor";
import { InlinePhoneEditor } from "@/components/fields/inline-editors/InlinePhoneEditor";
import { InlineSelectEditor } from "@/components/fields/inline-editors/InlineSelectEditor";
import { InlineMultiSelectEditor } from "@/components/fields/inline-editors/InlineMultiSelectEditor";
import { InlineNumberEditor } from "@/components/fields/inline-editors/InlineNumberEditor";
import { InlineDateEditor } from "@/components/fields/inline-editors/InlineDateEditor";
import { InlineCheckboxEditor } from "@/components/fields/inline-editors/InlineCheckboxEditor";
import { EnhancedEditLeadDialog } from "./EnhancedEditLeadDialog";
// Permissions removed for single photographer mode
import { validateFieldValue } from "@/lib/leadFieldValidation";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { cn } from "@/lib/utils";
import type { LeadFieldDefinition } from "@/types/leadFields";
import { useOptionalOrganization } from "@/hooks/useOptionalOrganization";

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  [key: string]: string | null | undefined;
}

interface UnifiedClientDetailsProps {
  lead: Lead;
  title?: string;
  showQuickActions?: boolean;
  onLeadUpdated?: () => void;
  className?: string;
  showClickableNames?: boolean;
  createdAt?: string | null; // creation date
  onNavigateToLead?: (leadId: string) => void;
  defaultExpanded?: boolean;
  showLeadNameInHeader?: boolean;
}

// Helper functions for validation and phone normalization
const isValidEmail = (email?: string | null) =>
  !!email && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);

function normalizeTRPhone(
  phone?: string | null
): null | { e164: string; e164NoPlus: string } {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  let e164 = "";

  if (phone.trim().startsWith("+")) {
    if (digits.startsWith("90") && digits.length === 12) {
      e164 = "+" + digits;
    } else {
      return null;
    }
  } else if (digits.startsWith("90") && digits.length === 12) {
    e164 = "+" + digits;
  } else if (digits.startsWith("0") && digits.length === 11) {
    e164 = "+90" + digits.slice(1);
  } else if (digits.length === 10) {
    e164 = "+90" + digits;
  } else {
    return null;
  }

  return {
    e164,
    e164NoPlus: e164.slice(1),
  };
}

export function UnifiedClientDetails({
  lead,
  title,
  showQuickActions = true,
  onLeadUpdated,
  className,
  showClickableNames = false,
  createdAt,
  onNavigateToLead,
  defaultExpanded = true,
  showLeadNameInHeader = true,
}: UnifiedClientDetailsProps) {
  const { toast } = useToast();
  const { fieldDefinitions, loading: fieldsLoading } =
    useLeadFieldDefinitions();
  const {
    fieldValues,
    loading: valuesLoading,
    refetch: refetchFieldValues,
  } = useLeadFieldValues(lead.id);

  const [hasLoadedFieldDefinitionsOnce, setHasLoadedFieldDefinitionsOnce] =
    useState(false);
  const [hasLoadedFieldValuesOnce, setHasLoadedFieldValuesOnce] =
    useState(false);

  useEffect(() => {
    if (!fieldsLoading && !hasLoadedFieldDefinitionsOnce) {
      setHasLoadedFieldDefinitionsOnce(true);
    }
  }, [fieldsLoading, hasLoadedFieldDefinitionsOnce]);

  useEffect(() => {
    if (!valuesLoading && !hasLoadedFieldValuesOnce) {
      setHasLoadedFieldValuesOnce(true);
    }
  }, [valuesLoading, hasLoadedFieldValuesOnce]);

  useEffect(() => {
    setHasLoadedFieldValuesOnce(false);
  }, [lead.id]);
  const [localLead, setLocalLead] = useState(lead);
  const pendingCoreUpdatesRef = useRef<Record<string, string | null>>({});
  // Permissions removed for single photographer mode - always allow
  const [editOpen, setEditOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t: tForms } = useFormsTranslation();
  const optionalOrganization = useOptionalOrganization();
  const activeOrganizationId =
    optionalOrganization?.activeOrganizationId ??
    optionalOrganization?.activeOrganization?.id ??
    null;
  const leadFieldHelperStorageKey = useMemo(
    () => `lead-fields-tip:${activeOrganizationId ?? "global"}`,
    [activeOrganizationId]
  );
  const [showFieldHelper, setShowFieldHelper] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(leadFieldHelperStorageKey);
      setShowFieldHelper(stored !== "dismissed");
    } catch {
      setShowFieldHelper(true);
    }
  }, [leadFieldHelperStorageKey]);

  const dismissLeadFieldHelper = () => {
    setShowFieldHelper(false);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(leadFieldHelperStorageKey, "dismissed");
    } catch {
      // Ignore storage failures
    }
  };

  const handleManageLeadFields = () => {
    navigate("/settings/leads#lead-fields");
  };

  const { updateCoreField, updateCustomField } = useLeadUpdate({
    leadId: lead.id,
    onSuccess: () => {
      refetchFieldValues?.();
      onLeadUpdated?.();
    },
  });

  const loading =
    (!hasLoadedFieldDefinitionsOnce && fieldsLoading) ||
    (!hasLoadedFieldValuesOnce && valuesLoading);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setLocalLead((prev) => {
      if (!prev || lead.id !== prev.id) {
        pendingCoreUpdatesRef.current = {};
        return lead;
      }

      const coreKeys: Array<keyof Lead> = ["name", "email", "phone", "notes"];
      const updatedFields: Partial<Lead> = {};
      let shouldUpdate = false;

      for (const key of coreKeys) {
        const parentValue = (lead[key] ?? null) as string | null;
        const prevValue = (prev[key] ?? null) as string | null;
        const pendingValue = pendingCoreUpdatesRef.current[key as string];

        if (pendingValue !== undefined && pendingValue !== parentValue) {
          continue;
        }

        if (pendingValue !== undefined && pendingValue === parentValue) {
          delete pendingCoreUpdatesRef.current[key as string];
        }

        if (parentValue !== prevValue) {
          updatedFields[key] = parentValue;
          shouldUpdate = true;
        }
      }

      return shouldUpdate ? { ...prev, ...updatedFields } : prev;
    });
  }, [lead]);

  // Combine core fields with custom fields
  type FieldEntry = {
    key: string;
    label: string;
    value: string | null;
    type: "core" | "custom";
    fieldDefinition?: LeadFieldDefinition;
  };

  const allFields: FieldEntry[] = [
    {
      key: "name",
      label: tForms("clientDetails.fullName"),
      value: localLead.name,
      type: "core",
    },
    {
      key: "email",
      label: tForms("clientDetails.email"),
      value: localLead.email ?? null,
      type: "core",
    },
    {
      key: "phone",
      label: tForms("clientDetails.phone"),
      value: localLead.phone ?? null,
      type: "core",
    },
    {
      key: "notes",
      label: tForms("clientDetails.notes"),
      value: localLead.notes ?? null,
      type: "core",
    },
    ...fieldDefinitions
      .filter(
        (field) =>
          !["name", "email", "phone", "notes", "status"].includes(
            field.field_key
          )
      )
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field) => ({
        key: field.field_key,
        label: field.label,
        value:
          fieldValues.find((fv) => fv.field_key === field.field_key)?.value ||
          null,
        type: "custom" as const,
        fieldDefinition: field,
      })),
  ];

  // Show all fields regardless of whether they have values
  const coreFields = allFields.filter((field) => field.type === "core");
  const customFields = allFields.filter((field) => field.type === "custom");
  const shouldShowFieldHelper = showFieldHelper && !loading;

  // Handle inline editing - Single photographer has full edit access
  const canEdit = true;

  const handleFieldSave = async (
    fieldKey: string,
    value: string,
    isCustom: boolean
  ) => {
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue === "" ? null : trimmedValue;

    // Validate custom fields before saving
    if (isCustom) {
      const fieldDef = fieldDefinitions.find((f) => f.field_key === fieldKey);
      if (fieldDef) {
        const validation = validateFieldValue(normalizedValue, fieldDef);
        if (!validation.isValid) {
          toast({
            title: "Validation Error",
            description: validation.error || "Invalid field value",
            variant: "destructive",
          });
          setEditingField(null);
          return;
        }
      }

      console.log(`Saving custom field "${fieldKey}":`, normalizedValue);
      await updateCustomField(fieldKey, normalizedValue);
    } else {
      console.log(`Saving core field "${fieldKey}":`, normalizedValue);
      await updateCoreField(fieldKey, normalizedValue);
      setLocalLead((prev) => ({
        ...prev,
        [fieldKey]: normalizedValue,
      }));
      pendingCoreUpdatesRef.current[fieldKey] = normalizedValue;
    }

    setEditingField(null);
  };

  const getInlineEditor = (field: FieldEntry) => {
    const fieldType =
      field.type === "custom" ? field.fieldDefinition?.field_type : field.key;
    const options = field.fieldDefinition?.options?.options || [];
    const allowMultiple = field.fieldDefinition?.allow_multiple || false;

    const commonProps = {
      value: field.value,
      onSave: (value: string) =>
        handleFieldSave(field.key, value, field.type === "custom"),
      onCancel: () => setEditingField(null),
    };

    switch (fieldType) {
      case "email":
        return <InlineEmailEditor {...commonProps} showButtons={true} />;
      case "phone":
        return <InlinePhoneEditor {...commonProps} showButtons={true} />;
      case "textarea":
      case "notes":
        return (
          <InlineTextareaEditor
            {...commonProps}
            maxLength={
              field.fieldDefinition?.validation_rules?.maxLength || 1000
            }
            showButtons={true}
          />
        );
      case "select":
        if (allowMultiple) {
          return (
            <InlineMultiSelectEditor
              {...commonProps}
              options={options}
              showButtons={true}
            />
          );
        } else {
          return (
            <InlineSelectEditor
              {...commonProps}
              options={options}
              showButtons={true}
              keepOpenOnSelect={false}
            />
          );
        }
      case "number":
        return (
          <InlineNumberEditor
            {...commonProps}
            min={field.fieldDefinition?.validation_rules?.min}
            max={field.fieldDefinition?.validation_rules?.max}
            showButtons={true}
          />
        );
      case "date":
        return <InlineDateEditor {...commonProps} showButtons={true} />;
      case "checkbox":
        return <InlineCheckboxEditor {...commonProps} showButtons={false} />;
      default:
        return (
          <InlineTextEditor
            {...commonProps}
            maxLength={
              field.fieldDefinition?.validation_rules?.maxLength || 255
            }
            showButtons={true}
          />
        );
    }
  };

  // Get phone and email for quick actions (from any field)
  const phoneField = allFields.find(
    (field) =>
      (field.key === "phone" ||
        field.fieldDefinition?.field_type === "phone") &&
      field.value
  );
  const emailField = allFields.find(
    (field) =>
      (field.key === "email" ||
        field.fieldDefinition?.field_type === "email") &&
      field.value
  );

  const normalizedPhone = phoneField
    ? normalizeTRPhone(phoneField.value)
    : null;
  const validEmail = emailField ? isValidEmail(emailField.value) : false;
  const quickActions = [
    normalizedPhone
      ? {
          key: "whatsapp",
          label: tForms("clientDetails.whatsApp"),
          icon: MessageCircle,
          href: `https://wa.me/${normalizedPhone.e164NoPlus}`,
          target: "_blank" as const,
        }
      : null,
    normalizedPhone
      ? {
          key: "sms",
          label: tForms("clientDetails.sms"),
          icon: MessageSquare,
          href: `sms:${normalizedPhone.e164}`,
        }
      : null,
    validEmail && emailField
      ? {
          key: "email",
          label: tForms("clientDetails.email"),
          icon: Mail,
          href: `mailto:${emailField.value}`,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: typeof Mail;
    href: string;
    target?: "_blank";
  }>;

  const hasQuickActions = showQuickActions && quickActions.length > 0;
  const shouldShowHeaderLeadName = showLeadNameInHeader && !isExpanded;

  const renderQuickActionButtons = (options?: { compact?: boolean }) => {
    const compact = options?.compact;

    return quickActions.map(({ key, label, icon: Icon, href, target }) => (
      <Button
        key={key}
        variant="outline"
        size="sm"
        asChild
        className={cn("h-7 text-xs px-2", compact ? "px-2" : "px-3")}
      >
        <a
          href={href}
          target={target}
          rel={target ? "noopener noreferrer" : undefined}
          aria-label={label}
        >
          <Icon className="mr-1 h-3 w-3" />
          {label}
        </a>
      </Button>
    ));
  };

  const leadNameDisplay = showClickableNames ? (
    <button
      type="button"
      onClick={() => {
        if (onNavigateToLead) {
          onNavigateToLead(lead.id);
        } else {
          navigate(`/leads/${lead.id}`);
        }
      }}
      data-touch-target="compact"
      className="block truncate text-sm font-medium text-accent underline-offset-2 hover:underline text-left"
    >
      {localLead.name || " - "}
    </button>
  ) : (
    <span className="block truncate text-sm font-medium text-accent">
      {localLead.name || " - "}
    </span>
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <h3 className="text-lg font-semibold">
            {title || tForms("clientDetails.title")}
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid grid-cols-3 gap-3">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="col-span-2 h-4 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader
          className={cn(
            isExpanded ? "pb-3" : "pb-2",
            "pl-2 pr-4 md:pl-4 md:pr-6"
          )}
        >
          <div className="flex items-start gap-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className={cn(
                "flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted flex-shrink-0",
                "h-9 w-7 md:w-8"
              )}
              aria-expanded={isExpanded}
              aria-label="Toggle client details"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isExpanded ? "" : "-rotate-90"
                )}
              />
            </button>
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="text-left leading-none"
                  aria-expanded={isExpanded}
                >
                  <span className="text-lg font-semibold">
                    {isExpanded
                      ? "Kişi Detayları"
                      : title || tForms("clientDetails.title")}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size={isExpanded ? "sm" : "icon"}
                  onClick={() => setEditOpen(true)}
                  className={cn(
                    "ml-auto bg-accent/10 text-accent transition-colors hover:bg-accent/20 flex-shrink-0",
                    isExpanded ? "h-9 px-3 text-sm font-medium" : "h-9 w-9 rounded-lg"
                  )}
                >
                  {isExpanded ? (
                    tForms("clientDetails.edit")
                  ) : (
                    <>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">
                        {tForms("clientDetails.edit")}
                      </span>
                    </>
                  )}
                </Button>
              </div>
              {shouldShowHeaderLeadName && (
                <div className="min-w-0 text-left">{leadNameDisplay}</div>
              )}
              {hasQuickActions && (
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-1.5",
                    isExpanded ? "pt-2" : "pt-1"
                  )}
                >
                  {isExpanded
                    ? renderQuickActionButtons()
                    : renderQuickActionButtons({ compact: true })}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}
          aria-hidden={!isExpanded}
        >
          <CardContent
            className={cn(
              "space-y-3 transition-[opacity,padding] duration-300 ease-in-out",
              isExpanded ? "opacity-100" : "opacity-0 py-0 md:py-0 pointer-events-none"
            )}
          >
            {coreFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tForms("clientDetails.noInfoAvailable")}
              </p>
            ) : (
              <div className="space-y-3">
                {coreFields.map((field) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-3 gap-3 items-start"
                  >
                    <label className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </label>
                    <div className="col-span-2 text-sm">
                      <InlineEditField
                        value={field.value}
                        isEditing={editingField === field.key}
                        onStartEdit={() => setEditingField(field.key)}
                        onSave={(value) =>
                          handleFieldSave(field.key, value, false)
                        }
                        onCancel={() => setEditingField(null)}
                        disabled={!canEdit}
                        editComponent={getInlineEditor(field)}
                      >
                        {field.key === "name" && showClickableNames ? (
                          <button
                            onClick={() => {
                              if (onNavigateToLead) {
                                onNavigateToLead(lead.id);
                              } else {
                                navigate(`/leads/${lead.id}`);
                              }
                            }}
                            data-touch-target="compact"
                            className="text-accent hover:underline font-medium break-words text-left"
                          >
                            {field.value || " - "}
                          </button>
                        ) : field.key === "notes" ? (
                          field.value ? (
                            <FieldTextareaDisplay
                              value={field.value}
                              maxLines={2}
                            />
                          ) : (
                            <span className="break-words text-muted-foreground">
                              {" "}
                              -{" "}
                            </span>
                          )
                        ) : (
                          <span className="break-words">
                            {field.value || " - "}
                          </span>
                        )}
                      </InlineEditField>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(shouldShowFieldHelper || customFields.length > 0) && (
              <div className="pt-3 border-t space-y-3">
                {shouldShowFieldHelper && (
                  <Alert className="relative border-amber-300/70 bg-amber-50 text-amber-900">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <AlertTitle className="text-sm font-semibold text-amber-900">
                          {tForms("lead_fields.helper.title")}
                        </AlertTitle>
                        <AlertDescription className="mt-1 text-sm text-amber-900/90">
                          {tForms("lead_fields.helper.description")}
                        </AlertDescription>
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-0 text-sm font-semibold text-amber-900 hover:bg-transparent hover:underline"
                            onClick={handleManageLeadFields}
                          >
                            {tForms("lead_fields.helper.action")}
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="tinted"
                        colorScheme="amber"
                        size="icon"
                        className="ml-2 shrink-0"
                        onClick={dismissLeadFieldHelper}
                        aria-label={tForms("lead_fields.helper.dismiss")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Alert>
                )}

                {customFields.length > 0 && (
                  <div className="space-y-3">
                    {customFields.map((field) => (
                      <div
                        key={field.key}
                        className="grid grid-cols-3 gap-3 items-start"
                      >
                        <label className="text-sm font-medium text-muted-foreground">
                          {field.label}
                        </label>
                        <div className="col-span-2 text-sm">
                          <InlineEditField
                            value={field.value}
                            isEditing={editingField === field.key}
                            onStartEdit={() => setEditingField(field.key)}
                            onSave={(value) =>
                              handleFieldSave(field.key, value, true)
                            }
                            onCancel={() => setEditingField(null)}
                            disabled={!canEdit}
                            disableOutsideCancel={
                              field.fieldDefinition?.field_type === "select"
                            }
                            editComponent={getInlineEditor(field)}
                          >
                            <CustomFieldDisplayWithEmpty
                              fieldDefinition={field.fieldDefinition!}
                              value={field.value}
                              showCopyButtons={false}
                              allowTruncation={true}
                              maxLines={2}
                            />
                          </InlineEditField>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Creation date - subtle and compact */}
            {createdAt && (
              <div className="mt-3 text-center">
                <span className="text-[10px] text-muted-foreground/60 font-normal">
                  {tForms("clientDetails.createdOn")}{" "}
                  {new Date(createdAt).toLocaleDateString("tr-TR", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Edit Dialog */}
      <EnhancedEditLeadDialog
        lead={lead}
        open={editOpen}
        onOpenChange={setEditOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => {
          // First refresh our own field values
          refetchFieldValues?.();
          // Then call parent's onLeadUpdated callback
          onLeadUpdated?.();
          setEditOpen(false);
        }}
      />
    </>
  );
}
