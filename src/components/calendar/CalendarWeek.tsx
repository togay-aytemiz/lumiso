import React, { memo, useMemo } from 'react';
import { format, addDays, startOfWeek, isToday, isSameDay } from 'date-fns';
import { formatTime, getUserLocale, getStartOfWeek } from '@/lib/utils';
import { CalendarDay } from './CalendarDay';
import { useSmartTimeRange } from '@/hooks/useSmartTimeRange';
import { useOrganizationTimezone } from '@/hooks/useOrganizationTimezone';
import { Badge } from '@/components/ui/badge';


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
  const { formatTime: formatOrgTime, loading: timezoneLoading } = useOrganizationTimezone();
  const { timeSlots, getSlotIndex } = useSmartTimeRange(sessions, activities);

  // Show loading skeleton while timezone settings are loading to prevent format switching
  if (timezoneLoading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="grid grid-cols-8 border-b border-border bg-muted/30 relative">
          <div className="p-3 w-16 shrink-0 sticky left-0 z-20 bg-card border-r border-border animate-pulse">
            <div className="h-4 bg-muted rounded"></div>
          </div>
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="p-3 text-center animate-pulse">
              <div className="h-4 bg-muted rounded mb-1"></div>
              <div className="h-6 bg-muted rounded"></div>
            </div>
          ))}
        </div>
        <div className="flex-1 max-h-[70vh] overflow-y-auto relative">
          {Array.from({ length: 24 }).map((_, index) => (
            <div key={index} className="grid grid-cols-8 border-b border-border/80 min-h-8 relative">
              <div className="w-16 shrink-0 sticky left-0 z-20 bg-card border-r border-border animate-pulse">
                <div className="h-6 bg-muted rounded m-1"></div>
              </div>
              {Array.from({ length: 7 }).map((_, dayIndex) => (
                <div key={dayIndex} className="p-1 border-r border-border animate-pulse">
                  <div className="h-6 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const weekDays = useMemo(() => {
    const weekStart = getStartOfWeek(currentDate, userLocale);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, userLocale]);

  const eventsByDayAndSlot = useMemo(() => {
    const eventMap = new Map<string, { sessions: Session[]; activities: Activity[] }>();
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayEvents = getEventsForDate(day);
      timeSlots.forEach((_, slotIndex) => {
        const key = `${dayKey}-${slotIndex}`;
        const sessionsInSlot = dayEvents.sessions.filter(s => getSlotIndex(s.session_time) === slotIndex);
        const activitiesInSlot = dayEvents.activities.filter(a => {
          if (!a.reminder_time) return slotIndex === 0;
          return getSlotIndex(a.reminder_time) === slotIndex;
        });
        if (sessionsInSlot.length || activitiesInSlot.length) {
          eventMap.set(key, { sessions: sessionsInSlot, activities: activitiesInSlot });
        }
      });
    });
    return eventMap;
  }, [weekDays, getEventsForDate, timeSlots, getSlotIndex]);

  if (isMobile) {
    const { sessions: daySessions, activities: dayActivities } = getEventsForDate(currentDate);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDays.map((day, index) => {
            const selected = isSameDay(day, currentDate);
            const today = isToday(day);
            return (
              <button
                key={index}
                onClick={() => onDayClick?.(day)}
                className={`p-2 text-center rounded transition-colors ${
                  selected ? 'bg-primary text-primary-foreground' : today ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                }`}
              >
                <div className="text-xs font-medium">{format(day, 'EEE')}</div>
                <div className="text-sm">{format(day, 'd')}</div>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {showSessions && daySessions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                Sessions ({daySessions.length})
              </h3>
              <div className="space-y-3">
                {daySessions.map(session => {
                  const leadName = leadsMap[session.lead_id]?.name || 'Lead';
                  const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;

                  return (
                    <button
                      key={session.id}
                      className="w-full p-4 bg-card rounded-lg border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      onClick={() => onSessionClick(session)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-primary mb-1">
                            {projectName || 'Session'}
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {leadName}
                          </div>
                          <div className="text-sm font-medium">
                            {formatOrgTime(session.session_time)}
                          </div>
                          {session.notes && (
                            <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {session.notes}
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                          {session.status}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showReminders && dayActivities.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/60"></div>
                Reminders ({dayActivities.length})
              </h3>
              <div className="space-y-3">
                {dayActivities.map(activity => {
                  const leadName = leadsMap[activity.lead_id]?.name || 'Lead';
                  const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
                  const timeText = activity.reminder_time ? formatOrgTime(activity.reminder_time) : 'All day';

                  return (
                    <button
                      key={activity.id}
                      className={`w-full p-4 bg-card rounded-lg border hover:bg-accent/50 transition-colors text-left ${
                        activity.completed ? 'opacity-60' : ''
                      }`}
                      onClick={() => onActivityClick(activity)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium mb-1 ${activity.completed ? 'line-through' : ''}`}>
                            {activity.content}
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {projectName ? `Project: ${projectName}` : `Lead: ${leadName}`}
                          </div>
                          <div className="text-sm font-medium">
                            {timeText}
                          </div>
                        </div>
                        <div className={`px-2 py-1 text-xs rounded-md ${
                          activity.completed ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {activity.completed ? 'Completed' : activity.type}
                        </div>
                      </div>
                    </button>
                  );
                })}
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

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="grid grid-cols-8 border-b border-border bg-muted/30 relative">
        <div className="p-3 w-16 shrink-0 sticky left-0 z-20 bg-card border-r border-border"></div>
        {weekDays.map((day, index) => {
          const today = isToday(day);
          return (
            <div key={index} className={`p-3 text-center ${today ? 'text-primary font-medium' : ''}`}>
              <div className="text-sm font-medium">{format(day, 'EEE')}</div>
              <div className={`text-lg ${today ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 max-h-[70vh] overflow-y-auto relative">
        {timeSlots.map((slot, slotIndex) => {
          const isHour = slot.minute === 0;
          const labelText = slot.display || '';

          return (
            <div
              key={`slot-${slotIndex}`}
              className="grid grid-cols-8 border-b border-border/80 min-h-8 relative"
            >
              {/* FIX 1 add right border and matching bottom border on sticky time column to remove the visual gap and continue the horizontal divider */}
              <div
                className={`w-16 shrink-0 text-xs text-muted-foreground sticky left-0 z-20 bg-card flex items-center justify-end pr-3 border-r border-border border-b border-border/80 ${isHour ? 'font-medium' : ''}`}
              >
                {labelText || '\u00A0'}
              </div>

              {weekDays.map((day, dayIndex) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const key = `${dayKey}-${slotIndex}`;
                const events = eventsByDayAndSlot.get(key);

                return (
                  <div
                    key={dayIndex}
                    className="relative p-1 hover:bg-accent/30 transition-colors border-r border-border"
                  >
                    {events && (
                      <div className="space-y-1">
                        {showSessions &&
                          events.sessions.map(session => (
                            <button
                              key={session.id}
                              className="w-full text-left px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors truncate"
                              onClick={() => onSessionClick(session)}
                            >
                              {leadsMap[session.lead_id]?.name || 'Lead'}
                            </button>
                          ))}

                        {showReminders &&
                          events.activities.map(activity => (
                            <button
                              key={activity.id}
                              className={`w-full text-left px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-accent transition-colors truncate ${
                                activity.completed ? 'opacity-60 line-through' : ''
                              }`}
                              onClick={() => onActivityClick(activity)}
                            >
                              {leadsMap[activity.lead_id]?.name || 'Lead'}
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
}, (p, n) => {
  return (
    p.currentDate.getTime() === n.currentDate.getTime() &&
    p.sessions.length === n.sessions.length &&
    p.activities.length === n.activities.length &&
    p.showSessions === n.showSessions &&
    p.showReminders === n.showReminders &&
    p.isMobile === n.isMobile &&
    JSON.stringify(p.sessions) === JSON.stringify(n.sessions) &&
    JSON.stringify(p.activities) === JSON.stringify(n.activities)
  );
});