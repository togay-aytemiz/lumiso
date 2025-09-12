import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  sendAssignmentNotification, 
  sendMilestoneNotification, 
  getCurrentUserAndOrg,
  getAssignmentChanges,
  isSignificantStatusChange
} from '@/lib/notificationUtils';

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
      // Get current lead state before update for change detection
      const { data: currentLead } = await supabase
        .from('leads')
        .select('name, status, assignees')
        .eq('id', leadId)
        .single();

      const updates: Record<string, any> = {
        [fieldKey]: value || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      // Handle notifications for specific field changes
      const { userId, orgId } = await getCurrentUserAndOrg();
      
      if (userId && orgId && currentLead) {
        // Handle status changes
        if (fieldKey === 'status' && isSignificantStatusChange(currentLead.status, value || '')) {
          await sendMilestoneNotification({
            type: 'lead',
            entity_id: leadId,
            entity_name: currentLead.name || 'Unnamed Lead',
            old_status: currentLead.status,
            new_status: value || '',
            changed_by_id: userId,
            organization_id: orgId,
            assignee_ids: currentLead.assignees || []
          });
        }

        // Handle assignee changes
        if (fieldKey === 'assignees') {
          const newAssignees = value ? JSON.parse(value) : [];
          const { added, removed } = getAssignmentChanges(currentLead.assignees || [], newAssignees);
          
          if (added.length > 0) {
            await sendAssignmentNotification({
              type: 'lead',
              entity_id: leadId,
              entity_name: currentLead.name || 'Unnamed Lead',
              assignee_ids: added,
              assigned_by_id: userId,
              organization_id: orgId,
              action: 'assigned'
            });
          }
          
          if (removed.length > 0) {
            await sendAssignmentNotification({
              type: 'lead',
              entity_id: leadId,
              entity_name: currentLead.name || 'Unnamed Lead',
              assignee_ids: removed,
              assigned_by_id: userId,
              organization_id: orgId,
              action: 'unassigned'
            });
          }
        }
      }

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