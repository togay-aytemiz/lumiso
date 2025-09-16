import React, { memo, useMemo } from 'react';
import { format, addDays, startOfWeek, isToday, isSameDay } from 'date-fns';
import { formatTime, getUserLocale, getStartOfWeek } from '@/lib/utils';
import { CalendarDay } from './CalendarDay';
import { useSmartTimeRange } from '@/hooks/useSmartTimeRange';
import { useOrganizationTimezone } from '@/hooks/useOrganizationTimezone';

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
 * Handles week view rendering with 30-minute time slots and events
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
  const { formatTime: formatOrgTime } = useOrganizationTimezone();
  const { timeSlots, getSlotIndex } = useSmartTimeRange(sessions, activities);
  
  // Memoized week calculation
  const weekDays = useMemo(() => {
    const weekStart = getStartOfWeek(currentDate, userLocale);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, userLocale]);

  // Memoized events by day and 30-minute time slot
  const eventsByDayAndSlot = useMemo(() => {
    const eventMap = new Map<string, { sessions: Session[]; activities: Activity[] }>();
    
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayEvents = getEventsForDate(day);
      
      // Group events by 30-minute slots
      timeSlots.forEach((slot, slotIndex) => {
        const key = `${dayKey}-${slotIndex}`;
        
        const sessionsInSlot = dayEvents.sessions.filter(session => {
          const sessionSlotIndex = getSlotIndex(session.session_time);
          return sessionSlotIndex === slotIndex;
        });
        
        const activitiesInSlot = dayEvents.activities.filter(activity => {
          if (!activity.reminder_time) {
            // All-day activities go in first slot of the day
            return slotIndex === 0;
          }
          const activitySlotIndex = getSlotIndex(activity.reminder_time);
          return activitySlotIndex === slotIndex;
        });
        
        if (sessionsInSlot.length > 0 || activitiesInSlot.length > 0) {
          eventMap.set(key, {
            sessions: sessionsInSlot,
            activities: activitiesInSlot
          });
        }
      });
    });
    
    return eventMap;
  }, [weekDays, getEventsForDate, timeSlots, getSlotIndex]);

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
                      <span className="font-semibold">{formatOrgTime(session.session_time)}</span>
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
                        {activity.reminder_time ? formatOrgTime(activity.reminder_time) : 'All day'}
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

  // Desktop: Show full week grid with 30-minute precision
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
      
      {/* Time slots and events - 30-minute precision */}
      <div className="flex-1">
        {timeSlots.map((slot, slotIndex) => {
          // Only show time labels for hour marks (not 30-minute marks)
          const showTimeLabel = slot.display !== '';
          
          return (
            <div 
              key={`${slot.time}-${slotIndex}`} 
              className={`grid grid-cols-8 border-b border-border ${showTimeLabel ? 'min-h-12' : 'min-h-6'} ${slot.minute === 30 ? 'border-b-dashed border-b-border/40' : ''}`}
            >
              {/* Time label - only for hour marks */}
              <div className={`p-2 text-xs text-muted-foreground text-right bg-muted/20 border-r border-border ${!showTimeLabel ? 'border-r-dashed border-r-border/40' : ''}`}>
                {slot.display}
              </div>
              
              {/* Day columns */}
              {weekDays.map((day, dayIndex) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const key = `${dayKey}-${slotIndex}`;
                const events = eventsByDayAndSlot.get(key);
                
                return (
                  <div 
                    key={dayIndex} 
                    className={`relative p-1 hover:bg-accent/30 transition-colors border-r border-border ${slot.minute === 30 ? 'border-r-dashed border-r-border/40' : ''}`}
                  >
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