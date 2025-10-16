import React, { memo, useMemo } from 'react';
import { format, addDays, startOfWeek, isToday, isSameDay } from 'date-fns';
import { formatTime, getUserLocale, getStartOfWeek, getDateFnsLocale } from '@/lib/utils';
import { CalendarDay } from './CalendarDay';
import { useSmartTimeRange } from '@/hooks/useSmartTimeRange';
import { useOrganizationTimezone } from '@/hooks/useOrganizationTimezone';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';


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

const TIME_COL_PX = 64; // matches Tailwind w-16

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
  const { t } = useTranslation('pages');
  const userLocale = getUserLocale();
  const dateFnsLocale = getDateFnsLocale();
  const { formatTime: formatOrgTime, loading: timezoneLoading } = useOrganizationTimezone();
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

  // loading skeleton that uses the same grid template to avoid layout jump
  if (timezoneLoading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div
          className="grid border-b border-border bg-muted/30 relative"
          style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="p-3 sticky left-0 z-30 bg-card border-r border-border animate-pulse">
            <div className="h-4 bg-muted rounded" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-3 text-center animate-pulse">
              <div className="h-4 bg-muted rounded mb-1" />
              <div className="h-6 bg-muted rounded" />
            </div>
          ))}
        </div>

        <div className="flex-1 max-h-[70vh] overflow-y-auto relative">
          {Array.from({ length: 24 }).map((_, r) => (
            <div
              key={r}
              className="grid border-b border-border/80 min-h-8 relative"
              style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
            >
              <div className="sticky left-0 z-30 bg-card border-r border-border border-b border-border/80">
                <div className="h-6 bg-muted rounded m-1" />
              </div>
              {Array.from({ length: 7 }).map((_, c) => (
                <div key={c} className="p-1 border-r border-border animate-pulse">
                  <div className="h-6 bg-muted rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

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
                <div className="text-xs font-medium">{format(day, 'EEE', { locale: dateFnsLocale })}</div>
                <div className="text-sm">{format(day, 'd')}</div>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {showSessions && daySessions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                {t('calendar.sections.sessions')} ({daySessions.length})
              </h3>
              <div className="space-y-3">
                {daySessions.map(session => {
                  const leadName = leadsMap[session.lead_id]?.name || t('calendar.labels.lead');
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
                            {projectName || t('calendar.labels.session')}
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
                <div className="w-3 h-3 rounded-full bg-muted-foreground/60" />
                {t('calendar.sections.reminders')} ({dayActivities.length})
              </h3>
              <div className="space-y-3">
                {dayActivities.map(activity => {
                  const leadName = leadsMap[activity.lead_id]?.name || t('calendar.labels.lead');
                  const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
                  const timeText = activity.reminder_time ? formatOrgTime(activity.reminder_time) : t('calendar.labels.allDay');
                  const shouldShowTypeBadge = !activity.completed && activity.type && activity.type.toLowerCase() !== 'reminder';

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
                            {projectName ? `${t('calendar.labels.project')}: ${projectName}` : `${t('calendar.labels.lead')}: ${leadName}`}
                          </div>
                          <div className="text-sm font-medium">
                            {timeText}
                          </div>
                        </div>
                        {(activity.completed || shouldShowTypeBadge) && (
                          <div className={`px-2 py-1 text-xs rounded-md ${
                            activity.completed ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'
                          }`}>
                            {activity.completed ? t('calendar.labels.completed') : activity.type}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {daySessions.length === 0 && dayActivities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('calendar.emptyStates.noEventsDay')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* header uses the same grid template as body */}
      <div
        className="grid border-b border-border bg-muted/30 relative"
        style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
      >
        <div className="p-3 sticky left-0 z-30 bg-card border-r border-border" />
        {weekDays.map((day, index) => {
          const today = isToday(day);
          return (
            <div key={index} className={`p-3 text-center ${today ? 'text-primary font-medium' : ''}`}>
              <div className="text-sm font-medium">{format(day, 'EEE', { locale: dateFnsLocale })}</div>
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
              className="grid border-b border-border/80 min-h-8 relative"
              style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
            >
              {/* time rail cell, sticky and with matching bottom border */}
              <div
                className={`sticky left-0 z-30 bg-card flex items-center justify-end pr-3 text-xs text-muted-foreground border-r border-border border-b border-border/80 ${isHour ? 'font-medium' : ''}`}
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
                              {leadsMap[session.lead_id]?.name || t('calendar.labels.lead')}
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
                              {leadsMap[activity.lead_id]?.name || t('calendar.labels.lead')}
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
