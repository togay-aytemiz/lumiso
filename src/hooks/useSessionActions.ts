import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCalendarSync } from './useCalendarSync';

type SessionStatus = 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';

export const useSessionActions = () => {
  const { toast } = useToast();
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

  const updateSessionStatus = async (sessionId: string, status: SessionStatus) => {
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