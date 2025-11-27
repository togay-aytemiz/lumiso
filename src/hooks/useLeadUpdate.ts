import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

interface UseLeadUpdateProps {
  leadId: string;
  onSuccess?: () => void;
}

export function useLeadUpdate({ leadId, onSuccess }: UseLeadUpdateProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { t: tForms } = useFormsTranslation();

  const updateCoreField = async (fieldKey: string, value: string | null) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const updates: Record<string, string | null> = {
        [fieldKey]: value || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: tForms("lead_field.toast.update_success_title"),
        description: tForms("lead_field.toast.update_success_description"),
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error updating core field:', error);
      toast({
        title: tForms("lead_field.toast.error_title"),
        description: tForms("lead_field.toast.update_error_description"),
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  const updateCustomField = async (fieldKey: string, value: string | null) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('lead_field_values')
        .upsert({
          lead_id: leadId,
          field_key: fieldKey,
          value: value || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'lead_id,field_key'
        });

      if (error) throw error;

      toast({
        title: tForms("lead_field.toast.update_success_title"),
        description: tForms("lead_field.toast.update_success_description"),
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error updating custom field:', error);
      toast({
        title: tForms("lead_field.toast.error_title"),
        description: tForms("lead_field.toast.update_error_description"),
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isUpdating,
    updateCoreField,
    updateCustomField
  };
}
