import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseLeadUpdateProps {
  leadId: string;
  onSuccess?: () => void;
}

export function useLeadUpdate({ leadId, onSuccess }: UseLeadUpdateProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const updateCoreField = async (fieldKey: string, value: string | null) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const updates: Record<string, any> = {
        [fieldKey]: value || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Field updated",
        description: "The field has been updated successfully.",
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error updating core field:', error);
      toast({
        title: "Update failed",
        description: "Failed to update the field. Please try again.",
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
        title: "Field updated",
        description: "The custom field has been updated successfully.",
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error updating custom field:', error);
      toast({
        title: "Update failed",
        description: "Failed to update the custom field. Please try again.",
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