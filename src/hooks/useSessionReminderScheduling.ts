import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSessionReminderScheduling() {
  const { toast } = useToast();

  const scheduleSessionReminders = useCallback(async (sessionId: string) => {
    try {
      console.log(`🔔 Scheduling reminders for session: ${sessionId}`);

      const { error } = await supabase.rpc('schedule_session_reminders', {
        session_id_param: sessionId
      });

      if (error) {
        console.error('❌ Error scheduling session reminders:', error);
        throw error;
      }

      console.log(`✅ Successfully scheduled reminders for session: ${sessionId}`);
      
      // Verify reminders were created
      const { data: reminders, error: checkError } = await supabase
        .from('scheduled_session_reminders')
        .select('id, reminder_type, scheduled_for, status')
        .eq('session_id', sessionId)
        .eq('status', 'pending');
        
      if (!checkError && reminders) {
        console.log(`📅 Created ${reminders.length} reminder(s):`, reminders.map(r => 
          `${r.reminder_type} at ${r.scheduled_for}`
        ));
      }
      
    } catch (error: unknown) {
      console.error('❌ Failed to schedule session reminders:', error);
      toast({
        title: 'Warning',
        description: 'Session created but reminders could not be scheduled automatically',
        variant: 'destructive',
      });
      // Don't throw - allow session creation to succeed even if reminders fail
    }
  }, [toast]);

  const cancelSessionReminders = useCallback(async (sessionId: string) => {
    try {
      console.log(`Cancelling reminders for session: ${sessionId}`);

      const { error } = await supabase
        .from('scheduled_session_reminders')
        .update({ 
          status: 'cancelled',
          processed_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error cancelling session reminders:', error);
        throw error;
      }

      console.log(`Successfully cancelled reminders for session: ${sessionId}`);
    } catch (error: unknown) {
      console.error('Failed to cancel session reminders:', error);
      // Don't show toast for this as it's usually called during deletion
      // and shouldn't block the main action
    }
  }, []);

  const rescheduleSessionReminders = useCallback(async (sessionId: string) => {
    try {
      console.log(`Rescheduling reminders for session: ${sessionId}`);

      // Cancel existing reminders first
      await cancelSessionReminders(sessionId);
      
      // Schedule new ones
      await scheduleSessionReminders(sessionId);

      console.log(`Successfully rescheduled reminders for session: ${sessionId}`);
    } catch (error: unknown) {
      console.error('Failed to reschedule session reminders:', error);
      toast({
        title: 'Warning', 
        description: 'Session updated but reminders could not be rescheduled automatically',
        variant: 'destructive',
      });
      // Don't throw - allow session update to succeed
    }
  }, [scheduleSessionReminders, cancelSessionReminders, toast]);

  return {
    scheduleSessionReminders,
    cancelSessionReminders,
    rescheduleSessionReminders,
  };
}
