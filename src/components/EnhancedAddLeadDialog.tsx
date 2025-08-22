import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import {
  Form,
} from "@/components/ui/form";
import { DynamicLeadFormFields } from "./DynamicLeadFormFields";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { createDynamicLeadSchema } from "@/lib/leadFieldValidation";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";

interface EnhancedAddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EnhancedAddLeadDialog({ 
  open, 
  onOpenChange, 
  onClose, 
  onSuccess 
}: EnhancedAddLeadDialogProps) {
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { upsertFieldValues } = useLeadFieldValues("");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Create dynamic schema based on field definitions
  const schema = createDynamicLeadSchema(fieldDefinitions);
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  // Track form dirty state
  const formValues = form.watch();
  useEffect(() => {
    const hasValues = Object.values(formValues).some(value => 
      value !== '' && value !== null && value !== undefined
    );
    setIsDirty(hasValues);
  }, [formValues]);

  useEffect(() => {
    if (open && !fieldsLoading) {
      // Reset form when dialog opens
      const defaultValues: Record<string, any> = {};
      fieldDefinitions.forEach(field => {
        const fieldName = `field_${field.field_key}`;
        switch (field.field_type) {
          case 'checkbox':
            defaultValues[fieldName] = false;
            break;
          case 'number':
            defaultValues[fieldName] = '';
            break;
          default:
            defaultValues[fieldName] = '';
        }
      });
      form.reset(defaultValues);
    }
  }, [open, fieldsLoading, fieldDefinitions, form]);

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error('No active organization found');
      }

      // Get default lead status
      const { data: defaultStatus } = await supabase
        .from('lead_statuses')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .single();

      // Create the lead record
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          organization_id: organizationId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          name: data.field_name || 'Unnamed Lead',
          email: data.field_email || null,
          phone: data.field_phone || null,
          notes: data.field_notes || null,
          status_id: defaultStatus?.id,
          assignees: [],
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Extract field values from form data
      const fieldValues: Record<string, string | null> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key.startsWith('field_')) {
          const fieldKey = key.replace('field_', '');
          fieldValues[fieldKey] = value ? String(value) : null;
        }
      });

      // Save field values
      await upsertFieldValues(newLead.id, fieldValues);

      toast({
        title: "Lead created",
        description: "The lead has been created successfully with custom field data.",
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to create lead:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: onClose,
      variant: "outline" as const,
    },
    {
      label: loading ? "Creating..." : "Create Lead",
      onClick: form.handleSubmit(onSubmit),
      loading,
      disabled: loading || fieldsLoading,
    }
  ];

  if (fieldsLoading) {
    return (
      <AppSheetModal
        title="Add New Lead"
        isOpen={open}
        onOpenChange={onOpenChange}
        size="lg"
        footerActions={[]}
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppSheetModal>
    );
  }

  return (
    <AppSheetModal
      title="Add New Lead"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="lg"
      dirty={isDirty}
      onDirtyClose={handleClose}
      footerActions={footerActions}
    >
      <div className="space-y-1 mb-6">
        <p className="text-sm text-muted-foreground">
          Create a new lead and capture custom information using your configured fields.
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
  );
}