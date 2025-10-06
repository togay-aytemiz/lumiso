import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useReminderActions = () => {
  const { toast } = useToast();

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;

      toast({
        title: "Reminder deleted",
        description: "Reminder has been removed from your calendar.",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Error deleting reminder",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateReminder = async (
    reminderId: string, 
    content: string, 
    reminderDate?: string, 
    reminderTime?: string,
    leadName?: string
  ) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({
          content,
          reminder_date: reminderDate || null,
          reminder_time: reminderTime || null,
        })
        .eq('id', reminderId);

      if (error) throw error;

      toast({
        title: "Reminder updated",
        description: "Reminder has been updated in your calendar.",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Error updating reminder",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    deleteReminder,
    updateReminder,
  };
};