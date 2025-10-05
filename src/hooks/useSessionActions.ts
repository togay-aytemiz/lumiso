import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSessionReminderScheduling } from '@/hooks/useSessionReminderScheduling';
import { useCalendarSync } from './useCalendarSync';
import { useWorkflowTriggers } from './useWorkflowTriggers';

export const useSessionActions = () => {
  const { toast } = useToast();
  const { cancelSessionReminders } = useSessionReminderScheduling();
  const { deleteSessionEvent } = useCalendarSync();
  const { triggerSessionCompleted, triggerSessionCancelled } = useWorkflowTriggers();

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      // Delete from Google Calendar (non-blocking)
      try {
        await deleteSessionEvent(sessionId);
      } catch (calendarError) {
        console.warn('Calendar deletion failed (non-blocking):', calendarError);
      }

      // Cancel session reminders (non-blocking) 
      try {
        await cancelSessionReminders(sessionId);
      } catch (reminderError) {
        console.error('Error cancelling session reminders:', reminderError);
        // Don't block deletion if reminder cancellation fails
      }

      toast({
        title: "Session deleted",
        description: "Session has been removed from your calendar.",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Error deleting session",
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
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