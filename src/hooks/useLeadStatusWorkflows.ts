import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkflowTriggers } from '@/hooks/useWorkflowTriggers';

export function useLeadStatusWorkflows() {
  const { triggerLeadStatusChange } = useWorkflowTriggers();

  const triggerLeadStatusWorkflow = async (
    leadId: string,
    organizationId: string,
    oldStatusName: string,
    newStatusName: string,
    leadData?: any
  ) => {
    try {
      await triggerLeadStatusChange(leadId, organizationId, oldStatusName, newStatusName, leadData);
    } catch (error) {
      console.error('Error triggering lead status workflow:', error);
    }
  };

  return {
    triggerLeadStatusWorkflow
  };
}