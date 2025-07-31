import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCalendarSync } from './useCalendarSync';

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

  return {
    deleteSession,
  };
};