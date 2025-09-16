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
              <h3 className="text-base font-medium mb-3">Sessions</h3>
              <div className="space-y-2">
                {daySessions.map(session => (
                  <button
                    key={session.id}
                    className="w-full text-left p-3 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    onClick={() => onSessionClick(session)}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{formatOrgTime(session.session_time)}</span>
                      <span>•</span>
                      <span>{leadsMap[session.lead_id]?.name || 'Lead'}</span>
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
                {dayActivities.map(activity => (
                  <button
                    key={activity.id}
                    className={`w-full text-left p-3 rounded-lg bg-muted border border-border hover:bg-accent transition-colors ${
                      activity.completed ? 'opacity-60 line-through' : ''
                    }`}
                    onClick={() => onActivityClick(activity)}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">
                        {activity.reminder_time ? formatOrgTime(activity.reminder_time) : 'All day'}
                      </span>
                      <span>•</span>
                      <span>{leadsMap[activity.lead_id]?.name || 'Lead'}</span>
                    </div>
                    {activity.content && <div className="text-xs text-muted-foreground mt-1">{activity.content}</div>}
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

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="grid grid-cols-8 border-b border-border bg-muted/30 relative">
        <div className="p-3 w-16 shrink-0 sticky left-0 z-20 bg-card"></div>
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
          const isHalf = slot.minute === 30;

          const labelText = isHour ? slot.display || '' : '';

          return (
            <div
              key={`slot-${slotIndex}`}
              className={`grid grid-cols-8 border-b ${isHour ? 'border-border min-h-12' : 'border-border/30 min-h-8'}`}
            >
              <div className="p-2 w-16 shrink-0 text-xs text-muted-foreground text-right sticky left-0 z-10 bg-card border-r border-border">
                {labelText || '\u00A0'}
              </div>

              {weekDays.map((day, dayIndex) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const key = `${dayKey}-${slotIndex}`;
                const events = eventsByDayAndSlot.get(key);

                return (
                  <div
                    key={dayIndex}
                    className={`relative p-1 hover:bg-accent/30 transition-colors border-r border-border ${isHalf ? 'bg-accent/5' : ''}`}
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