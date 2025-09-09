import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSessionReminderScheduling } from '@/hooks/useSessionReminderScheduling';
import { useCalendarSync } from './useCalendarSync';

export const useSessionActions = () => {
  const { toast } = useToast();
  const { cancelSessionReminders } = useSessionReminderScheduling();
  const { deleteSessionEvent } = useCalendarSync();

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      // Delete from Google Calendar
      await deleteSessionEvent(sessionId);

      // Cancel session reminders
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

  const updateSessionStatus = async (sessionId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status })
        .eq('id', sessionId);

      if (error) throw error;

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