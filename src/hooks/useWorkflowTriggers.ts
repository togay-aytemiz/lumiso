import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TriggerType } from '@/types/workflow';

type TriggerPayload = Record<string, unknown>;

type SessionTriggerData = TriggerPayload & {
  session_date?: string;
  session_time?: string;
  location?: string;
};

type StatusChangeData = TriggerPayload & {
  old_status?: string;
  new_status?: string;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : undefined);

const isSessionInPast = (sessionDate?: string, sessionTime?: string): boolean => {
  if (!sessionDate) return false;

  const safeTime = sessionTime && sessionTime.trim() ? sessionTime : "23:59:59";
  const sessionDateTime = new Date(`${sessionDate}T${safeTime}`);

  if (Number.isNaN(sessionDateTime.getTime())) {
    return false;
  }

  return sessionDateTime.getTime() < Date.now();
};

export function useWorkflowTriggers() {
  const { toast } = useToast();

  const triggerWorkflow = async (
    triggerType: TriggerType,
    entityType: string,
    entityId: string,
    organizationId: string,
    triggerData?: TriggerPayload
  ) => {
    try {
      // Input validation
      if (!triggerType || !entityType || !entityId || !organizationId) {
        throw new Error('Missing required parameters for workflow trigger');
      }

      // Validate UUID format for entityId and organizationId
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(entityId)) {
        throw new Error('Invalid entity ID format');
      }
      if (!uuidRegex.test(organizationId)) {
        throw new Error('Invalid organization ID format');
      }

      console.log(`Triggering workflows for: ${triggerType} on ${entityType}:${entityId}`);
      console.log(`📋 Trigger params:`, { triggerType, entityType, entityId, organizationId, triggerData });

      const { data, error } = await supabase.functions.invoke('workflow-executor', {
        body: {
          action: 'trigger',
          trigger_type: triggerType,
          trigger_entity_type: entityType,
          trigger_entity_id: entityId,
          organization_id: organizationId,
          trigger_data: triggerData || {}
        }
      });

      console.log(`📡 Workflow executor response:`, { data, error });

      if (error) {
        console.error('Error triggering workflows:', error);
        throw error;
      }

      const triggeredCount = data?.result?.triggered_workflows || 0;
      console.log(`Successfully triggered ${triggeredCount} workflows`);
      
      if (triggeredCount === 0) {
        console.log(`No workflows found for trigger type: ${triggerType}`);
      }

      return data?.result;

    } catch (error) {
      console.error('Error in triggerWorkflow:', error);
      
      // Only show toast for unexpected errors, not for "no workflows found" cases
      const message = getErrorMessage(error);
      if (message && !message.includes('No workflows found')) {
        toast({
          title: 'Workflow Error',
          description: message || 'Failed to trigger workflows',
          variant: 'destructive',
        });
      }
      
      throw error;
    }
  };

  // Session-specific triggers
  const triggerSessionScheduled = (
    sessionId: string,
    organizationId: string,
    sessionData?: SessionTriggerData,
    workflowIds?: string[]
  ) => {
    if (isSessionInPast(sessionData?.session_date, sessionData?.session_time)) {
      console.log(
        `Skipping session_scheduled workflows for past session ${sessionId} on ${sessionData?.session_date} ${sessionData?.session_time || ""}`
      );
      return Promise.resolve({ skipped: "session_in_past" });
    }

    const payload: Record<string, unknown> = {
      session_date: sessionData?.session_date,
      session_time: sessionData?.session_time,
      location: sessionData?.location,
      ...sessionData,
    };

    if (Array.isArray(workflowIds) && workflowIds.length > 0) {
      payload.workflow_ids = workflowIds;
    }

    return triggerWorkflow('session_scheduled', 'session', sessionId, organizationId, payload);
  };

  const triggerSessionCompleted = (sessionId: string, organizationId: string, sessionData?: SessionTriggerData) => {
    return triggerWorkflow('session_completed', 'session', sessionId, organizationId, sessionData);
  };

  const triggerSessionCancelled = (sessionId: string, organizationId: string, sessionData?: SessionTriggerData) => {
    return triggerWorkflow('session_cancelled', 'session', sessionId, organizationId, sessionData);
  };

  const triggerSessionRescheduled = (sessionId: string, organizationId: string, oldDate: string, newDate: string, sessionData?: SessionTriggerData) => {
    return triggerWorkflow('session_rescheduled', 'session', sessionId, organizationId, {
      old_date: oldDate,
      new_date: newDate,
      ...sessionData
    });
  };

  const triggerSessionReminder = (sessionId: string, organizationId: string, sessionData?: SessionTriggerData) => {
    return triggerWorkflow('session_reminder', 'session', sessionId, organizationId, sessionData);
  };

  // Project-specific triggers
  const triggerProjectStatusChange = (projectId: string, organizationId: string, oldStatus: string, newStatus: string, projectData?: StatusChangeData) => {
    return triggerWorkflow('project_status_change', 'project', projectId, organizationId, {
      old_status: oldStatus,
      new_status: newStatus,
      ...projectData
    });
  };

  // Lead-specific triggers
  const triggerLeadStatusChange = (leadId: string, organizationId: string, oldStatus: string, newStatus: string, leadData?: StatusChangeData) => {
    return triggerWorkflow('lead_status_change', 'lead', leadId, organizationId, {
      old_status: oldStatus,
      new_status: newStatus,
      ...leadData
    });
  };

  return {
    triggerWorkflow,
    triggerSessionScheduled,
    triggerSessionCompleted,
    triggerSessionCancelled,
    triggerSessionRescheduled,
    triggerSessionReminder,
    triggerProjectStatusChange,
    triggerLeadStatusChange,
  };
}
