import React, { memo, useMemo } from 'react';
import { format, addDays, startOfWeek, isToday, isSameDay } from 'date-fns';
import { formatTime, getUserLocale, getStartOfWeek } from '@/lib/utils';
import { CalendarDay } from './CalendarDay';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  notes?: string;
  lead_id: string;
  project_id?: string | null;
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

interface CalendarWeekProps {
  currentDate: Date;
  sessions: Session[];
  activities: Activity[];
  showSessions: boolean;
  showReminders: boolean;
  leadsMap: Record<string, { id: string; name: string }>;
  projectsMap: Record<string, { id: string; name: string; lead_id: string }>;
  isMobile: boolean;
  getEventsForDate: (date: Date) => { sessions: Session[]; activities: Activity[] };
  onSessionClick: (session: Session) => void;
  onActivityClick: (activity: Activity) => void;
  onDayClick?: (date: Date) => void;
}

/**
 * Optimized calendar week component with memoization
 * Handles week view rendering with time slots and events
 */
export const CalendarWeek = memo<CalendarWeekProps>(function CalendarWeek({
  currentDate,
  sessions,
  activities,
  showSessions,
  showReminders,
  leadsMap,
  projectsMap,
  isMobile,
  getEventsForDate,
  onSessionClick,
  onActivityClick,
  onDayClick
}) {
  const userLocale = getUserLocale();
  
  // Memoized week calculation
  const weekDays = useMemo(() => {
    const weekStart = getStartOfWeek(currentDate, userLocale);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, userLocale]);

  // Memoized time slots (8 AM to 10 PM for better UX)
  const timeSlots = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const hour = i + 8;
      return {
        time: `${hour.toString().padStart(2, '0')}:00`,
        display: format(new Date(2000, 0, 1, hour), 'h a')
      };
    });
  }, []);

  // Memoized events by day and time slot
  const eventsByDayAndHour = useMemo(() => {
    const eventMap = new Map<string, { sessions: Session[]; activities: Activity[] }>();
    
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayEvents = getEventsForDate(day);
      
      // Group events by hour
      timeSlots.forEach(({ time }) => {
        const hour = parseInt(time.split(':')[0]);
        const key = `${dayKey}-${hour}`;
        
        const sessionsInHour = dayEvents.sessions.filter(session => {
          const sessionHour = parseInt(session.session_time.split(':')[0]);
          return sessionHour === hour;
        });
        
        const activitiesInHour = dayEvents.activities.filter(activity => {
          if (!activity.reminder_time) return hour === 8; // Default to 8 AM for all-day
          const activityHour = parseInt(activity.reminder_time.split(':')[0]);
          return activityHour === hour;
        });
        
        if (sessionsInHour.length > 0 || activitiesInHour.length > 0) {
          eventMap.set(key, {
            sessions: sessionsInHour,
            activities: activitiesInHour
          });
        }
      });
    });
    
    return eventMap;
  }, [weekDays, getEventsForDate, timeSlots]);

  if (isMobile) {
    // Mobile: Show simplified day view for current date
    const { sessions: daySessions, activities: dayActivities } = getEventsForDate(currentDate);
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDays.map((day, index) => {
            const isSelected = isSameDay(day, currentDate);
            const isDayToday = isToday(day);
            
            return (
              <button
                key={index}
                onClick={() => onDayClick?.(day)}
                className={`p-2 text-center rounded transition-colors ${
                  isSelected 
                    ? 'bg-primary text-primary-foreground' 
                    : isDayToday 
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent'
                }`}
              >
                <div className="text-xs font-medium">{format(day, 'EEE')}</div>
                <div className="text-sm">{format(day, 'd')}</div>
              </button>
            );
          })}
        </div>
        
        {/* Show selected day's events */}
        <div className="space-y-4">
          {showSessions && daySessions.length > 0 && (
            <div>
              <h3 className="text-base font-medium mb-3">Sessions</h3>
              <div className="space-y-2">
                {daySessions.map((session) => (
                  <button
                    key={session.id}
                    className="w-full text-left p-3 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    onClick={() => onSessionClick(session)}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{formatTime(session.session_time, userLocale)}</span>
                      <span>•</span>
                      <span>{leadsMap[session.lead_id]?.name || "Lead"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {showReminders && dayActivities.length > 0 && (
            <div>
              <h3 className="text-base font-medium mb-3">Reminders</h3>
              <div className="space-y-2">
                {dayActivities.map((activity) => (
                  <button
                    key={activity.id}
                    className={`w-full text-left p-3 rounded-lg bg-muted border border-border hover:bg-accent transition-colors ${activity.completed ? 'opacity-60 line-through' : ''}`}
                    onClick={() => onActivityClick(activity)}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">
                        {activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : 'All day'}
                      </span>
                      <span>•</span>
                      <span>{leadsMap[activity.lead_id]?.name || "Lead"}</span>
                    </div>
                    {activity.content && (
                      <div className="text-xs text-muted-foreground mt-1">{activity.content}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {daySessions.length === 0 && dayActivities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No events for this day</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: Show full week grid
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Week header */}
      <div className="grid grid-cols-8 border-b border-border bg-muted/30">
        <div className="p-3"></div> {/* Empty corner */}
        {weekDays.map((day, index) => {
          const isDayToday = isToday(day);
          return (
            <div key={index} className={`p-3 text-center ${isDayToday ? 'text-primary font-medium' : ''}`}>
              <div className="text-sm font-medium">{format(day, 'EEE')}</div>
              <div className={`text-lg ${isDayToday ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
            </div>
          );
        })}
      </div>
      
      {/* Time slots and events */}
      <div className="flex-1">
        {timeSlots.map(({ time, display }) => {
          const hour = parseInt(time.split(':')[0]);
          
          return (
            <div key={time} className="grid grid-cols-8 border-b border-border min-h-12">
              {/* Time label */}
              <div className="p-2 text-xs text-muted-foreground text-right bg-muted/20 border-r border-border">
                {display}
              </div>
              
              {/* Day columns */}
              {weekDays.map((day, dayIndex) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const key = `${dayKey}-${hour}`;
                const events = eventsByDayAndHour.get(key);
                
                return (
                  <div key={dayIndex} className="relative p-1 hover:bg-accent/30 transition-colors border-r border-border">
                    {events && (
                      <div className="space-y-1">
                        {/* Sessions */}
                        {showSessions && events.sessions.map((session) => (
                          <button
                            key={session.id}
                            className="w-full text-left px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors truncate"
                            onClick={() => onSessionClick(session)}
                          >
                            {leadsMap[session.lead_id]?.name || "Lead"}
                          </button>
                        ))}
                        
                        {/* Activities */}
                        {showReminders && events.activities.map((activity) => (
                          <button
                            key={activity.id}
                            className={`w-full text-left px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-accent transition-colors truncate ${activity.completed ? 'opacity-60 line-through' : ''}`}
                            onClick={() => onActivityClick(activity)}
                          >
                            {leadsMap[activity.lead_id]?.name || "Lead"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal performance
  return (
    prevProps.currentDate.getTime() === nextProps.currentDate.getTime() &&
    prevProps.sessions.length === nextProps.sessions.length &&
    prevProps.activities.length === nextProps.activities.length &&
    prevProps.showSessions === nextProps.showSessions &&
    prevProps.showReminders === nextProps.showReminders &&
    prevProps.isMobile === nextProps.isMobile &&
    JSON.stringify(prevProps.sessions) === JSON.stringify(nextProps.sessions) &&
    JSON.stringify(prevProps.activities) === JSON.stringify(nextProps.activities)
  );
});