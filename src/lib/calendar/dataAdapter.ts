import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'session' | 'reminder';
  start: string; // ISO datetime
  end?: string; // ISO datetime (optional for all-day)
  allDay?: boolean;
  extendedProps: {
    type: 'session' | 'reminder';
    source: 'Sessions' | 'Reminders';
    status?: string;
    leadId?: string;
    leadName?: string;
  };
}

interface SessionData {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  status?: string;
  leads?: {
    name: string;
  };
}

interface ReminderData {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time?: string;
  lead_id: string;
  leads?: {
    name: string;
  };
}

/**
 * Loads sessions within the specified date range
 */
export const loadSessions = async (dateRange: { start: string; end: string }): Promise<CalendarEvent[]> => {
  try {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        lead_id,
        session_date,
        session_time,
        notes,
        status,
        leads (
          name
        )
      `)
      .gte('session_date', dateRange.start.split('T')[0])
      .lte('session_date', dateRange.end.split('T')[0]);

    if (error) throw error;

    return (sessions as SessionData[])?.map(session => {
      const startDateTime = `${session.session_date}T${session.session_time || '00:00:00'}`;
      
      return {
        id: `session-${session.id}`,
        title: `Session: ${session.leads?.name || 'Unknown Client'}`,
        type: 'session' as const,
        start: startDateTime,
        allDay: !session.session_time,
        extendedProps: {
          type: 'session' as const,
          source: 'Sessions' as const,
          status: session.status,
          leadId: session.lead_id,
          leadName: session.leads?.name,
        },
      };
    }) || [];
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
};

/**
 * Loads reminders within the specified date range
 */
export const loadReminders = async (dateRange: { start: string; end: string }): Promise<CalendarEvent[]> => {
  try {
    // First get reminders with lead names joined
    const { data: reminders, error } = await supabase
      .from('activities')
      .select('*')
      .not('reminder_date', 'is', null)
      .gte('reminder_date', dateRange.start.split('T')[0])
      .lte('reminder_date', dateRange.end.split('T')[0]);

    if (error) throw error;

    // Then get lead names separately 
    const leadIds = reminders?.map(r => r.lead_id).filter(Boolean) || [];
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name')
      .in('id', leadIds);

    const leadMap = new Map(leads?.map(lead => [lead.id, lead.name]) || []);

    return (reminders || []).map(reminder => {
      const startDateTime = reminder.reminder_time 
        ? `${reminder.reminder_date}T${reminder.reminder_time}`
        : `${reminder.reminder_date}T00:00:00`;
      
      return {
        id: `reminder-${reminder.id}`,
        title: `Reminder: ${reminder.content}`,
        type: 'reminder' as const,
        start: startDateTime,
        allDay: !reminder.reminder_time,
        extendedProps: {
          type: 'reminder' as const,
          source: 'Reminders' as const,
          leadId: reminder.lead_id,
          leadName: leadMap.get(reminder.lead_id),
        },
      };
    }) || [];
  } catch (error) {
    console.error('Error loading reminders:', error);
    return [];
  }
};

/**
 * Loads both sessions and reminders for the calendar
 */
export const loadCalendarEvents = async (dateRange: { start: string; end: string }): Promise<CalendarEvent[]> => {
  const [sessions, reminders] = await Promise.all([
    loadSessions(dateRange),
    loadReminders(dateRange),
  ]);

  return [...sessions, ...reminders];
};