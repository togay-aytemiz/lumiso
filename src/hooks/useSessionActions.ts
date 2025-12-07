import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSessionReminderScheduling } from '@/hooks/useSessionReminderScheduling';
import { useWorkflowTriggers } from './useWorkflowTriggers';
import { useOnboardingDeletionGuard } from './useOnboardingDeletionGuard';

export const useSessionActions = () => {
  const { toast } = useToast();
  const { cancelSessionReminders } = useSessionReminderScheduling();
  const { triggerSessionCompleted, triggerSessionCancelled } = useWorkflowTriggers();
  const { ensureCanDelete } = useOnboardingDeletionGuard();

  const deleteSession = async (sessionId: string) => {
    if (!ensureCanDelete()) {
      return false;
    }

    try {
      // Hard-delete any scheduled reminders first to avoid FK constraint issues
      const { error: remindersError } = await supabase
        .from('scheduled_session_reminders')
        .delete()
        .eq('session_id', sessionId);

      if (remindersError) {
        console.error('Error deleting scheduled reminders for session:', remindersError);
        // Continue; if FK prevents deletion we'll catch below
      }

      // Delete the session and verify deletion affected at least one row
      const { data: deletedRows, error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .select('id');

      if (deleteError) throw deleteError;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Session could not be deleted. It may not exist or you may not have permission.');
      }

      toast({
        title: "Session deleted",
        description: "Session has been removed from your calendar.",
      });

      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error('Failed to delete session:', { sessionId, error });
      toast({
        title: "Error deleting session",
        description: message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateSessionStatus = async (sessionId: string, newStatus: string) => {
    try {
      // First, get the current session data including old status
      const { data: sessionData, error: fetchError } = await supabase
        .from('sessions')
        .select(`
          id,
          status,
          session_date,
          session_time, 
          location,
          lead_id,
          project_id,
          organization_id,
          leads(name)
        `)
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;
      
      const oldStatus = sessionData.status;
      
      // Update the session status
      const { error } = await supabase
        .from('sessions')
        .update({ status: newStatus })
        .eq('id', sessionId);

      if (error) throw error;

      // Trigger appropriate workflows based on new status
      if (oldStatus !== newStatus && sessionData.organization_id) {
        try {
          const triggerData = {
            old_status: oldStatus,
            new_status: newStatus,
            session_date: sessionData.session_date,
            session_time: sessionData.session_time,
            location: sessionData.location,
            lead_id: sessionData.lead_id,
            project_id: sessionData.project_id,
            client_name: sessionData.leads?.name || 'Unknown Client'
          };

          if (newStatus === 'completed') {
            console.log(`🚀 Triggering session_completed workflow for session: ${sessionId}`);
            await triggerSessionCompleted(sessionId, sessionData.organization_id, triggerData);
          } else if (newStatus === 'cancelled') {
            console.log(`🚀 Triggering session_cancelled workflow for session: ${sessionId}`);
            await triggerSessionCancelled(sessionId, sessionData.organization_id, triggerData);
          }
        } catch (workflowError) {
          console.error('❌ Error triggering workflow for status change:', workflowError);
          // Don't fail the status update if workflow fails
          toast({
            title: "Warning",
            description: "Status updated successfully, but notifications may not be sent.",
            variant: "default"
          });
        }
      }

      toast({
        title: "Success",
        description: "Session status updated successfully."
      });

      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to update session status";
      toast({
        title: "Error updating status",
        description: message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    deleteSession,
    updateSessionStatus,
  };
};
