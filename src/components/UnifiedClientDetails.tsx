import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MessageCircle } from "lucide-react";
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
import { InlineNumberEditor } from "@/components/fields/inline-editors/InlineNumberEditor";
import { InlineDateEditor } from "@/components/fields/inline-editors/InlineDateEditor";
import { InlineCheckboxEditor } from "@/components/fields/inline-editors/InlineCheckboxEditor";
import { EnhancedEditLeadDialog } from "./EnhancedEditLeadDialog";
// Permissions removed for single photographer mode
import { validateFieldValue } from "@/lib/leadFieldValidation";

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  [key: string]: any;
}

interface UnifiedClientDetailsProps {
  lead: Lead;
  title?: string;
  showQuickActions?: boolean;
  onLeadUpdated?: () => void;
  className?: string;
  showClickableNames?: boolean;
  createdAt?: string | null; // creation date
}

// Helper functions for validation and phone normalization
const isValidEmail = (email?: string | null) => !!email && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);

function normalizeTRPhone(phone?: string | null): null | { e164: string; e164NoPlus: string } {
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
    e164NoPlus: e164.slice(1)
  };
}

export function UnifiedClientDetails({ 
  lead, 
  title = "Client Details",
  showQuickActions = true,
  onLeadUpdated,
  className,
  showClickableNames = false,
  createdAt
}: UnifiedClientDetailsProps) {
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { fieldValues, loading: valuesLoading, refetch: refetchFieldValues } = useLeadFieldValues(lead.id);
  // Permissions removed for single photographer mode - always allow
  const [editOpen, setEditOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const navigate = useNavigate();

  const { updateCoreField, updateCustomField } = useLeadUpdate({
    leadId: lead.id,
    onSuccess: () => {
      refetchFieldValues?.();
      onLeadUpdated?.();
    }
  });

  const loading = fieldsLoading || valuesLoading;

  // Combine core fields with custom fields
  const allFields: Array<{
    key: string;
    label: string;
    value: string | null;
    type: 'core' | 'custom';
    fieldDefinition?: any;
  }> = [
    { key: 'name', label: 'Full Name', value: lead.name, type: 'core' },
    { key: 'email', label: 'Email', value: lead.email, type: 'core' },
    { key: 'phone', label: 'Phone', value: lead.phone, type: 'core' },
    { key: 'notes', label: 'Notes', value: lead.notes, type: 'core' },
    ...fieldDefinitions
      .filter(field => !['name', 'email', 'phone', 'notes', 'status'].includes(field.field_key))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(field => ({
        key: field.field_key,
        label: field.label,
        value: fieldValues.find(fv => fv.field_key === field.field_key)?.value || null,
        type: 'custom' as const,
        fieldDefinition: field
      }))
  ];

  // Show all fields regardless of whether they have values
  const coreFields = allFields.filter(field => field.type === 'core');
  const customFields = allFields.filter(field => field.type === 'custom');

  // Handle inline editing - Single photographer has full edit access
  const canEdit = true;

  const handleFieldSave = async (fieldKey: string, value: string, isCustom: boolean) => {
    const trimmedValue = value.trim();
    
    if (isCustom) {
      await updateCustomField(fieldKey, trimmedValue || null);
    } else {
      await updateCoreField(fieldKey, trimmedValue || null);
    }
    
    setEditingField(null);
  };

  const getInlineEditor = (field: any) => {
    const fieldType = field.type === 'custom' ? field.fieldDefinition?.field_type : field.key;
    const options = field.fieldDefinition?.options?.options || [];

    const commonProps = {
      value: field.value,
      onSave: (value: string) => handleFieldSave(field.key, value, field.type === 'custom'),
      onCancel: () => setEditingField(null)
    };

    switch (fieldType) {
      case 'email':
        return <InlineEmailEditor {...commonProps} />;
      case 'phone':
        return <InlinePhoneEditor {...commonProps} />;
      case 'textarea':
      case 'notes':
        return <InlineTextareaEditor {...commonProps} maxLength={field.fieldDefinition?.validation_rules?.maxLength || 1000} />;
      case 'select':
        return <InlineSelectEditor {...commonProps} options={options} />;
      case 'number':
        return <InlineNumberEditor {...commonProps} min={field.fieldDefinition?.validation_rules?.min} max={field.fieldDefinition?.validation_rules?.max} />;
      case 'date':
        return <InlineDateEditor {...commonProps} />;
      case 'checkbox':
        return <InlineCheckboxEditor {...commonProps} />;
      default:
        return <InlineTextEditor {...commonProps} maxLength={field.fieldDefinition?.validation_rules?.maxLength || 255} />;
    }
  };

  // Get phone and email for quick actions (from any field)
  const phoneField = allFields.find(field => 
    (field.key === 'phone' || field.fieldDefinition?.field_type === 'phone') && field.value
  );
  const emailField = allFields.find(field => 
    (field.key === 'email' || field.fieldDefinition?.field_type === 'email') && field.value
  );

  const normalizedPhone = phoneField ? normalizeTRPhone(phoneField.value) : null;
  const validEmail = emailField ? isValidEmail(emailField.value) : false;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <h3 className="text-lg font-semibold">{title}</h3>
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            {/* Single photographer has full edit access */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="text-muted-foreground h-8 px-3"
            >
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {coreFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client information available.</p>
          ) : (
            <div className="space-y-3">
              {coreFields.map(field => (
                <div key={field.key} className="grid grid-cols-3 gap-3 items-start">
                  <label className="text-sm font-medium text-muted-foreground">
                    {field.label}
                  </label>
                  <div className="col-span-2 text-sm">
                    <InlineEditField
                      value={field.value}
                      isEditing={editingField === field.key}
                      onStartEdit={() => setEditingField(field.key)}
                      onSave={(value) => handleFieldSave(field.key, value, false)}
                      onCancel={() => setEditingField(null)}
                      disabled={!canEdit}
                      editComponent={getInlineEditor(field)}
                    >
                      {field.key === 'name' && showClickableNames ? (
                        <button 
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="text-accent hover:underline font-medium break-words text-left"
                        >
                          {field.value || ' - '}
                        </button>
                      ) : field.key === 'notes' ? (
                        field.value ? (
                          <FieldTextareaDisplay 
                            value={field.value} 
                            maxLines={2}
                          />
                        ) : (
                          <span className="break-words text-muted-foreground"> - </span>
                        )
                      ) : (
                        <span className="break-words">{field.value || ' - '}</span>
                      )}
                    </InlineEditField>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {showQuickActions && (normalizedPhone || validEmail) && (
            <div className="flex flex-wrap gap-2 pt-3 border-t sm:flex-row flex-col sm:gap-2 gap-1">
              {normalizedPhone && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs h-7"
                  >
                    <a href={`https://wa.me/${normalizedPhone.e164NoPlus}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3 w-3 mr-1" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs h-7"
                  >
                    <a href={`tel:${normalizedPhone.e164}`}>
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </a>
                  </Button>
                </>
              )}
              {validEmail && emailField && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-xs h-7"
                >
                  <a href={`mailto:${emailField.value}`}>
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* Custom Fields Section */}
          {customFields.length > 0 && (
            <div className="pt-3 border-t">
              <div className="space-y-3">
                {customFields.map(field => (
                  <div key={field.key} className="grid grid-cols-3 gap-3 items-start">
                    <label className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </label>
                    <div className="col-span-2 text-sm">
                      <InlineEditField
                        value={field.value}
                        isEditing={editingField === field.key}
                        onStartEdit={() => setEditingField(field.key)}
                        onSave={(value) => handleFieldSave(field.key, value, true)}
                        onCancel={() => setEditingField(null)}
                        disabled={!canEdit}
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
            </div>
          )}

          {/* Creation date - subtle and compact */}
          {createdAt && (
            <div className="mt-3 text-center">
              <span className="text-[10px] text-muted-foreground/60 font-normal">
                Created on {new Date(createdAt).toLocaleDateString('tr-TR', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          )}
        </CardContent>
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