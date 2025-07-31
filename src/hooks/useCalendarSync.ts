import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGoogleCalendar } from './useGoogleCalendar';

interface SessionData {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  google_event_id?: string;
}

interface ReminderData {
  id: string;
  lead_id: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  google_event_id?: string;
}

interface LeadData {
  name: string;
}

export const useCalendarSync = () => {
  const { connection } = useGoogleCalendar();
  const { toast } = useToast();

  const createSessionEvent = useCallback(async (sessionData: SessionData, leadData: LeadData) => {
    if (!connection.connected) return;

    try {
      const sessionDateTime = `${sessionData.session_date}T${sessionData.session_time}`;
      const startTime = new Date(sessionDateTime);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour default

      const eventData = {
        summary: `📸 Session with ${leadData.name}`,
        description: sessionData.notes || `Session with ${leadData.name}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'create',
          type: 'session',
          entityId: sessionData.id,
          eventData,
        },
      });

      if (error) {
        console.error('Failed to sync session to calendar:', error);
        toast({
          title: "Calendar sync failed",
          description: "Failed to add session to Google Calendar",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
    }
  }, [connection.connected, toast]);

  const updateSessionEvent = useCallback(async (sessionData: SessionData, leadData: LeadData) => {
    if (!connection.connected || !sessionData.google_event_id) return;

    try {
      const sessionDateTime = `${sessionData.session_date}T${sessionData.session_time}`;
      const startTime = new Date(sessionDateTime);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const eventData = {
        summary: `📸 Session with ${leadData.name}`,
        description: sessionData.notes || `Session with ${leadData.name}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'update',
          type: 'session',
          entityId: sessionData.id,
          eventData,
        },
      });

      if (error) {
        console.error('Failed to update session in calendar:', error);
        toast({
          title: "Calendar sync failed",
          description: "Failed to update session in Google Calendar",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
    }
  }, [connection.connected, toast]);

  const deleteSessionEvent = useCallback(async (sessionId: string) => {
    if (!connection.connected) return;

    try {
      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'delete',
          type: 'session',
          entityId: sessionId,
        },
      });

      if (error) {
        console.error('Failed to delete session from calendar:', error);
        toast({
          title: "Calendar sync failed",
          description: "Failed to remove session from Google Calendar",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
    }
  }, [connection.connected, toast]);

  const createReminderEvent = useCallback(async (reminderData: ReminderData, leadData: LeadData) => {
    if (!connection.connected) return;

    try {
      let eventData;

      if (reminderData.reminder_date && reminderData.reminder_time) {
        // Specific date and time
        const reminderDateTime = `${reminderData.reminder_date}T${reminderData.reminder_time}`;
        const startTime = new Date(reminderDateTime);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes default

        eventData = {
          summary: `🔔 Reminder for ${leadData.name}`,
          description: reminderData.content,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };
      } else if (reminderData.reminder_date) {
        // All-day event
        eventData = {
          summary: `🔔 Reminder for ${leadData.name}`,
          description: reminderData.content,
          start: {
            date: reminderData.reminder_date,
          },
          end: {
            date: new Date(new Date(reminderData.reminder_date).getTime() + 24 * 60 * 60 * 1000)
              .toISOString().split('T')[0],
          },
        };
      } else {
        return; // No date set, cannot create event
      }

      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'create',
          type: 'reminder',
          entityId: reminderData.id,
          eventData,
        },
      });

      if (error) {
        console.error('Failed to sync reminder to calendar:', error);
        toast({
          title: "Calendar sync failed",
          description: "Failed to add reminder to Google Calendar",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
    }
  }, [connection.connected, toast]);

  const updateReminderEvent = useCallback(async (reminderData: ReminderData, leadData: LeadData) => {
    if (!connection.connected || !reminderData.google_event_id) return;

    try {
      let eventData;

      if (reminderData.reminder_date && reminderData.reminder_time) {
        const reminderDateTime = `${reminderData.reminder_date}T${reminderData.reminder_time}`;
        const startTime = new Date(reminderDateTime);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

        eventData = {
          summary: `🔔 Reminder for ${leadData.name}`,
          description: reminderData.content,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };
      } else if (reminderData.reminder_date) {
        eventData = {
          summary: `🔔 Reminder for ${leadData.name}`,
          description: reminderData.content,
          start: {
            date: reminderData.reminder_date,
          },
          end: {
            date: new Date(new Date(reminderData.reminder_date).getTime() + 24 * 60 * 60 * 1000)
              .toISOString().split('T')[0],
          },
        };
      } else {
        return;
      }

      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'update',
          type: 'reminder',
          entityId: reminderData.id,
          eventData,
        },
      });

      if (error) {
        console.error('Failed to update reminder in calendar:', error);
        toast({
          title: "Calendar sync failed",
          description: "Failed to update reminder in Google Calendar",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
    }
  }, [connection.connected, toast]);

  const deleteReminderEvent = useCallback(async (reminderId: string) => {
    if (!connection.connected) return;

    try {
      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'delete',
          type: 'reminder',
          entityId: reminderId,
        },
      });

      if (error) {
        console.error('Failed to delete reminder from calendar:', error);
        toast({
          title: "Calendar sync failed",
          description: "Failed to remove reminder from Google Calendar",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
    }
  }, [connection.connected, toast]);

  return {
    createSessionEvent,
    updateSessionEvent,
    deleteSessionEvent,
    createReminderEvent,
    updateReminderEvent,
    deleteReminderEvent,
    isConnected: connection.connected,
  };
};