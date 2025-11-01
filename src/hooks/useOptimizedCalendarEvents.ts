import { useMemo } from "react";
import { format } from "date-fns";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  notes?: string;
  lead_id: string;
  project_id?: string | null;
  duration_minutes?: number | null;
}

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time?: string;
  type: string;
  lead_id: string;
  project_id?: string | null;
  completed?: boolean;
}

/**
 * Optimized hook for computing calendar events with memoization
 * Eliminates expensive re-calculations on every render
 */
export function useOptimizedCalendarEvents(
  sessions: Session[],
  activities: Activity[],
  showSessions: boolean,
  showReminders: boolean
) {
  // Pre-compute and group events by date for efficient lookup
  const eventsByDate = useMemo(() => {
    const eventsMap = new Map<string, { sessions: Session[]; activities: Activity[] }>();
    
    // Process sessions if enabled
    if (showSessions) {
      sessions.forEach(session => {
        const dateKey = session.session_date;
        if (!eventsMap.has(dateKey)) {
          eventsMap.set(dateKey, { sessions: [], activities: [] });
        }
        eventsMap.get(dateKey)!.sessions.push(session);
      });
    }
    
    // Process activities if enabled
    if (showReminders) {
      activities.forEach(activity => {
        if (!activity.reminder_date) return;
        
        try {
          const dateKey = format(new Date(activity.reminder_date), "yyyy-MM-dd");
          if (!eventsMap.has(dateKey)) {
            eventsMap.set(dateKey, { sessions: [], activities: [] });
          }
          eventsMap.get(dateKey)!.activities.push(activity);
        } catch (error) {
          // Silently skip invalid dates in production
          if (process.env.NODE_ENV === 'development') {
            console.warn('Invalid activity date:', activity.reminder_date, error);
          }
        }
      });
    }
    
    // Sort events within each date for consistent ordering
    eventsMap.forEach(events => {
      events.sessions.sort((a, b) => a.session_time.localeCompare(b.session_time));
      events.activities.sort((a, b) => {
        if (!a.reminder_time && !b.reminder_time) return 0;
        if (!a.reminder_time) return 1;
        if (!b.reminder_time) return -1;
        return a.reminder_time.localeCompare(b.reminder_time);
      });
    });
    
    return eventsMap;
  }, [sessions, activities, showSessions, showReminders]);

  // Optimized function to get events for a specific date
  const getEventsForDate = useMemo(() => {
    return (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const events = eventsByDate.get(dateStr);
      
      return {
        sessions: events?.sessions || [],
        activities: events?.activities || []
      };
    };
  }, [eventsByDate]);

  // Pre-compute statistics for the current date range
  const eventStats = useMemo(() => {
    let totalSessions = 0;
    let totalActivities = 0;
    let datesWithEvents = 0;
    
    eventsByDate.forEach(events => {
      const hasEvents = events.sessions.length > 0 || events.activities.length > 0;
      if (hasEvents) {
        datesWithEvents++;
        totalSessions += events.sessions.length;
        totalActivities += events.activities.length;
      }
    });
    
    return {
      totalSessions,
      totalActivities,
      datesWithEvents,
      totalEvents: totalSessions + totalActivities
    };
  }, [eventsByDate]);

  return {
    getEventsForDate,
    eventsByDate,
    eventStats
  };
}
