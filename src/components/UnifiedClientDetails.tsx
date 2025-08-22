import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Phone, Mail, MessageCircle } from "lucide-react";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { CustomFieldDisplay } from "@/components/fields/CustomFieldDisplay";
import { EnhancedEditLeadDialog } from "./EnhancedEditLeadDialog";
import { usePermissions } from "@/hooks/usePermissions";

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
  showClickableNames = false
}: UnifiedClientDetailsProps) {
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { fieldValues, loading: valuesLoading } = useLeadFieldValues(lead.id);
  const { hasPermission } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const navigate = useNavigate();

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
      .filter(field => !['name', 'email', 'phone', 'notes'].includes(field.field_key))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(field => ({
        key: field.field_key,
        label: field.label,
        value: fieldValues.find(fv => fv.field_key === field.field_key)?.value || null,
        type: 'custom' as const,
        fieldDefinition: field
      }))
  ];

  // Filter out empty fields for display (but show all in edit mode)
  const fieldsToShow = allFields.filter(field => field.value);

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
          <CardTitle>{title}</CardTitle>
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
        <CardHeader className="pb-3 relative">
          <h3 className="text-lg font-semibold">{title}</h3>
          {hasPermission('edit_assigned_leads') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="absolute top-2 right-2 text-muted-foreground h-8 px-2"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {fieldsToShow.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client information available.</p>
          ) : (
            <div className="space-y-3">
              {fieldsToShow.map(field => (
                <div key={field.key} className="grid grid-cols-3 gap-3 items-start">
                  <label className="text-sm font-medium text-muted-foreground">
                    {field.label}
                  </label>
                   <div className="col-span-2 text-sm">
                     {field.type === 'core' ? (
                       field.key === 'name' && showClickableNames ? (
                         <button 
                           onClick={() => navigate(`/leads/${lead.id}`)}
                           className="text-link hover:underline font-medium break-words text-left"
                         >
                           {field.value}
                         </button>
                       ) : field.key === 'notes' && field.value ? (
                         <div className="whitespace-pre-wrap break-words bg-muted/50 p-2 rounded-md text-sm">
                           {field.value}
                         </div>
                       ) : (
                         <span className="break-words">{field.value || 'Not provided'}</span>
                       )
                     ) : (
                       <CustomFieldDisplay
                         fieldDefinition={field.fieldDefinition!}
                         value={field.value}
                         showCopyButtons={false}
                         allowTruncation={true}
                         maxLines={2}
                       />
                     )}
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
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EnhancedEditLeadDialog
        lead={lead}
        open={editOpen}
        onOpenChange={setEditOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => {
          onLeadUpdated?.();
          setEditOpen(false);
        }}
      />
    </>
  );
}