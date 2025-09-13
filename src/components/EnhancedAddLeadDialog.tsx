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
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { createDynamicLeadSchema } from "@/lib/leadFieldValidation";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";
// Assignee components removed - single user organization
import { useProfile } from "@/contexts/ProfileContext";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";

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
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Assignees removed - single user organization

  // Create dynamic schema based on field definitions
  const schema = createDynamicLeadSchema(fieldDefinitions);
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  // Auto-add current user as first assignee (single photographer mode)

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
      const setDefaultValues = async () => {
        const defaultValues: Record<string, any> = {};
        
        // Get organization ID for status lookup
        const organizationId = await getUserOrganizationId();
        
        for (const field of fieldDefinitions) {
          const fieldName = `field_${field.field_key}`;
          
          if (field.field_key === 'status' && organizationId) {
            // Set default status to "New" or the default status
            try {
              const { data: defaultStatus } = await supabase
                .from('lead_statuses')
                .select('name')
                .eq('organization_id', organizationId)
                .eq('is_default', true)
                .maybeSingle();
              
              defaultValues[fieldName] = defaultStatus?.name || 'New';
            } catch (error) {
              console.error('Error fetching default status:', error);
              defaultValues[fieldName] = 'New';
            }
          } else {
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
          }
        }
        
        form.reset(defaultValues);
      };
      
      setDefaultValues();
    }
  }, [open, fieldsLoading, fieldDefinitions, form]);

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error('No active organization found');
      }

      // Get status_id based on selected status or default
      let statusId = null;
      if (data.field_status) {
        const { data: statusData } = await supabase
          .from('lead_statuses')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('name', data.field_status)
          .maybeSingle();
        statusId = statusData?.id;
      } else {
        // Get default lead status
        const { data: defaultStatus } = await supabase
          .from('lead_statuses')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_default', true)
          .maybeSingle();
        statusId = defaultStatus?.id;
      }

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
          status_id: statusId,
          // assignees removed - single user organization
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

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      onClose();
    },
    onSaveAndExit: async () => {
      await form.handleSubmit(onSubmit)();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
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
        <FormLoadingSkeleton rows={4} />
      </AppSheetModal>
    );
  }

  return (
    <>
      <AppSheetModal
        title="Add New Lead"
        isOpen={open}
        onOpenChange={onOpenChange}
        size="lg"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
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
          
          {/* Assignees removed - single user organization */}
        </Form>
      </AppSheetModal>
      
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message="You have unsaved lead changes."
      />
    </>
  );
}