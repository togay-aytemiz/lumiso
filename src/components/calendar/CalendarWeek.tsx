import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import { getUserLocale, getStartOfWeek, getDateFnsLocale, cn } from '@/lib/utils';
import { useSmartTimeRange } from '@/hooks/useSmartTimeRange';
import { useOrganizationTimezone } from '@/hooks/useOrganizationTimezone';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Circle, Loader2, MapPin } from 'lucide-react';


interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  session_name?: string | null;
  notes?: string;
  location?: string | null;
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

interface CalendarWeekProps {
  currentDate: Date;
  sessions: Session[];
  activities: Activity[];
  showSessions: boolean;
  showReminders: boolean;
  maxHeight?: string | number;
  className?: string;
  fullHeight?: boolean;
  leadsMap: Record<string, { id: string; name: string }>;
  projectsMap: Record<string, { id: string; name: string; lead_id: string }>;
  isMobile: boolean;
  getEventsForDate: (date: Date) => { sessions: Session[]; activities: Activity[] };
  onSessionClick: (session: Session) => void;
  onActivityClick: (activity: Activity) => void;
  onDayClick?: (date: Date) => void;
  onToggleReminderCompletion?: (activity: Activity, nextCompleted: boolean) => void;
  completingReminderId?: string | null;
}

const TIME_COL_PX = 72;
const REMINDER_BASE_BLOCK_MINUTES = 30;
const REMINDER_EXPANDED_BLOCK_MINUTES = 45;

const minutesToTimeString = (minutes: number) => {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

interface PositionedLayout<T> {
  entity: T;
  top: number;
  height: number;
  startMinutes: number;
  endMinutes: number;
  columnIndex: number;
  columnCount: number;
  isAllDay?: boolean;
}

function assignColumnLayout<T>(items: PositionedLayout<T>[]) {
  const sorted = [...items].sort((a, b) => {
    if (a.startMinutes === b.startMinutes) {
      return a.endMinutes - b.endMinutes;
    }
    return a.startMinutes - b.startMinutes;
  });

  const active: Array<{ columnIndex: number; endMinutes: number; item: PositionedLayout<T> }> = [];

  sorted.forEach(item => {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].endMinutes <= item.startMinutes) {
        active.splice(i, 1);
      }
    }

    const usedColumns = new Set(active.map(entry => entry.columnIndex));
    let columnIndex = 0;
    while (usedColumns.has(columnIndex)) {
      columnIndex += 1;
    }

    item.columnIndex = columnIndex;
    item.columnCount = Math.max(item.columnCount, active.length + 1);

    active.push({ columnIndex, endMinutes: item.endMinutes, item });
    active.sort((a, b) => a.endMinutes - b.endMinutes);

    const overlapCount = active.length;
    active.forEach(entry => {
      entry.item.columnCount = Math.max(entry.item.columnCount, overlapCount);
    });
  });
}

export const CalendarWeek = memo<CalendarWeekProps>(function CalendarWeek({
  currentDate,
  sessions,
  activities,
  showSessions,
  showReminders,
  maxHeight,
  leadsMap,
  projectsMap,
  isMobile,
  getEventsForDate,
  onSessionClick,
  onActivityClick,
  onDayClick,
  onToggleReminderCompletion,
  completingReminderId,
  className,
  fullHeight
}) {
  const { t } = useTranslation(['pages', 'forms']);
  const userLocale = getUserLocale();
  const dateFnsLocale = getDateFnsLocale();
  const { formatTime: formatOrgTime, loading: timezoneLoading } = useOrganizationTimezone();
  const { timeSlots, getSlotIndex } = useSmartTimeRange(sessions, activities);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(false);
  const [slotHeight, setSlotHeight] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [scrollbarPadding, setScrollbarPadding] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const baseSlotHeight = slotHeight || 32; // fallback to base cell height until measured
  const effectiveSlotHeight = useMemo(() => {
    if (isMobile || !timeSlots.length || !fullHeight) {
      return baseSlotHeight;
    }
    if (!containerHeight) {
      return baseSlotHeight;
    }
    const stretchedHeight = containerHeight / timeSlots.length;
    return Math.max(baseSlotHeight, stretchedHeight);
  }, [baseSlotHeight, containerHeight, fullHeight, isMobile, timeSlots.length]);

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
  const dayIndicators = useMemo(
    () =>
      weekDays.map(day => {
        const dayEvents = getEventsForDate(day);
        return {
          hasSession: showSessions && dayEvents.sessions.length > 0,
          hasReminder: showReminders && dayEvents.activities.length > 0
        };
      }),
    [getEventsForDate, showReminders, showSessions, weekDays]
  );
  const eventSlotCount = eventsByDayAndSlot.size;
  const currentDateTimestamp = currentDate.getTime();
  const containerMaxHeight = useMemo(() => {
    if (fullHeight) return '100%';
    if (typeof maxHeight === 'number') return `${maxHeight}px`;
    return maxHeight ?? '60vh';
  }, [fullHeight, maxHeight]);
  const scrollContainerClassName = cn(
    'overflow-y-auto relative',
    fullHeight && 'flex-1 min-h-0'
  );
  const scrollContainerStyle = { maxHeight: containerMaxHeight };
  const rootClassName = cn(
    'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden',
    fullHeight && 'flex flex-1 flex-col h-full min-h-0',
    className
  );

  useEffect(() => {
    if (typeof window === 'undefined' || isMobile) return;

    const updateCurrentTime = () => setCurrentTime(new Date());
    updateCurrentTime();
    const intervalId = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(intervalId);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;

    const measureSlotHeight = () => {
      if (!gridRef.current?.firstElementChild) return;
      const firstRow = gridRef.current.firstElementChild as HTMLElement;
      const { height } = firstRow.getBoundingClientRect();
      setSlotHeight(height);
    };

    measureSlotHeight();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measureSlotHeight);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', measureSlotHeight);
      }
    };
  }, [isMobile, timeSlots.length, eventSlotCount]);

  useEffect(() => {
    autoScrollRef.current = false;
  }, [currentDateTimestamp, timeSlots.length, isMobile]);

  useEffect(() => {
    if (isMobile) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const updatePaddingAndHeight = () => {
      const target = scrollContainerRef.current;
      if (!target) return;
      const offsetWidth = target.offsetWidth;
      const clientWidth = target.clientWidth;
      const nextPadding = Math.max(0, offsetWidth - clientWidth);
      setScrollbarPadding(current => (current !== nextPadding ? nextPadding : current));
      const nextHeight = target.clientHeight;
      setContainerHeight(current => (current !== nextHeight ? nextHeight : current));
    };

    updatePaddingAndHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updatePaddingAndHeight());
      observer.observe(container);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updatePaddingAndHeight);
      return () => window.removeEventListener('resize', updatePaddingAndHeight);
    }
  }, [isMobile, timeSlots.length]);

  const currentTimeIndicator = useMemo(() => {
    if (isMobile || timeSlots.length === 0) {
      return null;
    }

    const startSlot = timeSlots[0];
    const endSlot = timeSlots[timeSlots.length - 1];
    const startMinutes = startSlot.hour * 60 + startSlot.minute;
    const endMinutes = endSlot.hour * 60 + endSlot.minute + 30;
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
      return null;
    }

    const minutesFromStart = nowMinutes - startMinutes;
    const baseIndex = Math.floor(minutesFromStart / 30);
    const remainderMinutes = minutesFromStart % 30;
    const offset = effectiveSlotHeight * baseIndex + (effectiveSlotHeight * remainderMinutes) / 30;
    const label = formatOrgTime(
      `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime
        .getMinutes()
        .toString()
        .padStart(2, '0')}`
    );

    return { offset, label };
  }, [currentTime, effectiveSlotHeight, formatOrgTime, isMobile, timeSlots]);

  const firstBusySlotIndex = useMemo(() => {
    if (isMobile) return -1;

    for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
      const hasEvents = weekDays.some(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        return eventsByDayAndSlot.has(`${dayKey}-${slotIndex}`);
      });

      if (hasEvents) {
        return slotIndex;
      }
    }

    return -1;
  }, [eventsByDayAndSlot, isMobile, timeSlots, weekDays]);

  useEffect(() => {
    if (
      isMobile ||
      !scrollContainerRef.current ||
      !gridRef.current ||
      effectiveSlotHeight === 0 ||
      autoScrollRef.current
    ) {
      return;
    }

    const container = scrollContainerRef.current;
    const gridElement = gridRef.current;

    if (!container || !gridElement) {
      return;
    }

    const containerHeight = container.clientHeight;
    const maxScrollable = gridElement.scrollHeight - containerHeight;

    const scrollToTarget = (target: number) => {
      let nextTarget = target;
      if (nextTarget < 0) nextTarget = 0;
      if (nextTarget > maxScrollable) nextTarget = maxScrollable;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: nextTarget, behavior: 'smooth' });
      } else {
        container.scrollTop = nextTarget;
      }
    };

    if (currentTimeIndicator) {
      const visibilityBias = effectiveSlotHeight * 2; // keep roughly an hour visible above now
      scrollToTarget(currentTimeIndicator.offset - visibilityBias);
      autoScrollRef.current = true;
      return;
    }

    if (firstBusySlotIndex >= 0) {
      scrollToTarget(firstBusySlotIndex * effectiveSlotHeight - containerHeight / 2);
      autoScrollRef.current = true;
    }
  }, [currentTimeIndicator, effectiveSlotHeight, firstBusySlotIndex, isMobile]);

  const rangeStartMinutes = useMemo(() => {
    if (!timeSlots.length) return 0;
    const startSlot = timeSlots[0];
    return startSlot.hour * 60 + startSlot.minute;
  }, [timeSlots]);

  const rangeEndMinutes = useMemo(() => {
    if (!timeSlots.length) return 0;
    const endSlot = timeSlots[timeSlots.length - 1];
    return endSlot.hour * 60 + endSlot.minute + 30;
  }, [timeSlots]);

  const gridHeight = useMemo(() => {
    if (!timeSlots.length) return 0;
    return effectiveSlotHeight * timeSlots.length;
  }, [effectiveSlotHeight, timeSlots.length]);

  const parseTimeToMinutes = (timeString?: string | null) => {
    if (!timeString) return null;
    const [hourPart, minutePart] = timeString.split(':').map(part => Number.parseInt(part, 10));
    if (Number.isNaN(hourPart) || Number.isNaN(minutePart)) return null;
    return hourPart * 60 + minutePart;
  };

  const eventLayoutsByDay = useMemo(() => {
    if (!timeSlots.length) {
      return new Map<string, { sessions: Array<PositionedLayout<Session>>; activities: Array<PositionedLayout<Activity>> }>();
    }

    const minutesToPixels = (minutes: number) => (minutes / 30) * effectiveSlotHeight;
    const minVisualHeight = effectiveSlotHeight * 0.75;

    return weekDays.reduce((acc, day) => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayEvents = getEventsForDate(day);

      const sessionLayouts: Array<PositionedLayout<Session>> = [];
      const activityLayouts: Array<PositionedLayout<Activity>> = [];

      dayEvents.sessions.forEach(session => {
        const startMinutes = parseTimeToMinutes(session.session_time);
        if (startMinutes == null) return;

        const rawDuration = session.duration_minutes ?? 60;
        const durationMinutes = Math.max(30, rawDuration);
        const endMinutes = startMinutes + durationMinutes;

        const clampedStart = Math.min(Math.max(startMinutes, rangeStartMinutes), rangeEndMinutes);
        const clampedEnd = Math.min(Math.max(endMinutes, clampedStart + 30), rangeEndMinutes);

        if (clampedEnd <= rangeStartMinutes || clampedStart >= rangeEndMinutes) {
          return;
        }

        const topMinutes = clampedStart - rangeStartMinutes;
        const heightMinutes = clampedEnd - clampedStart;

        sessionLayouts.push({
          entity: session,
          top: minutesToPixels(topMinutes),
          height: Math.max(minVisualHeight, minutesToPixels(heightMinutes)),
          startMinutes: clampedStart,
          endMinutes: clampedEnd,
          columnIndex: 0,
          columnCount: 1
        });
      });

      dayEvents.activities.forEach(activity => {
        const startMinutes = parseTimeToMinutes(activity.reminder_time);
        const isAllDay = startMinutes == null;
        const effectiveStartMinutes = isAllDay ? rangeStartMinutes : startMinutes;

        const clampedStart = Math.min(Math.max(effectiveStartMinutes, rangeStartMinutes), rangeEndMinutes);
        const activityLabel = leadsMap[activity.lead_id]?.name;
        const needsMoreRoom = (activity.content?.length ?? 0) > 18 || (activityLabel?.length ?? 0) > 18;
        const baseDuration = isAllDay ? REMINDER_EXPANDED_BLOCK_MINUTES : REMINDER_BASE_BLOCK_MINUTES;
        const blockMinutes = needsMoreRoom ? REMINDER_EXPANDED_BLOCK_MINUTES : baseDuration;
        const clampedEnd = Math.min(clampedStart + blockMinutes, rangeEndMinutes);

        if (clampedEnd <= rangeStartMinutes || clampedStart >= rangeEndMinutes) {
          return;
        }

        const topMinutes = clampedStart - rangeStartMinutes;
        const heightMinutes = clampedEnd - clampedStart || REMINDER_BASE_BLOCK_MINUTES;
        const reminderHeight = Math.max(minVisualHeight * 0.85, minutesToPixels(heightMinutes));

        activityLayouts.push({
          entity: activity,
          top: minutesToPixels(topMinutes),
          height: reminderHeight,
          startMinutes: clampedStart,
          endMinutes: clampedEnd,
          columnIndex: 0,
          columnCount: 1,
          isAllDay
        });
      });

      const unifiedLayouts: Array<PositionedLayout<Session> | PositionedLayout<Activity>> = [
        ...sessionLayouts,
        ...activityLayouts
      ];

      assignColumnLayout(unifiedLayouts);

      acc.set(dayKey, { sessions: sessionLayouts, activities: activityLayouts });
      return acc;
    }, new Map<string, { sessions: Array<PositionedLayout<Session>>; activities: Array<PositionedLayout<Activity>> }>());
  }, [effectiveSlotHeight, getEventsForDate, leadsMap, rangeEndMinutes, rangeStartMinutes, timeSlots.length, weekDays]);

  // loading skeleton that uses the same grid template to avoid layout jump
  if (timezoneLoading) {
    return (
      <div className={rootClassName}>
        <div
          className="grid border-b border-slate-200/80 bg-slate-50/70 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="px-3 py-2 text-right border-r border-slate-200/70">
            <div className="mx-auto h-3 w-14 rounded-full bg-slate-200/80 animate-pulse" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-1 border-l border-slate-200/70 first:border-l-0 px-3 py-2">
              <div className="h-3 w-10 rounded-full bg-slate-200/80 animate-pulse" />
              <div className="h-3 w-8 rounded-full bg-slate-200/80 animate-pulse" />
            </div>
          ))}
        </div>

        <div className={scrollContainerClassName} style={scrollContainerStyle}>
          {Array.from({ length: 24 }).map((_, r) => (
            <div
              key={r}
              className="grid min-h-[48px] border-t border-slate-200/70"
              style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
            >
              <div className="sticky left-0 z-30 flex items-center justify-end border-r border-slate-200/70 bg-slate-50/60 px-3">
                <div className="h-3 w-10 rounded-full bg-slate-200/70 animate-pulse" />
              </div>
              {Array.from({ length: 7 }).map((_, c) => (
                <div
                  key={c}
                  className="relative border-l border-slate-200/60 first:border-l-0"
                >
                  <div className="absolute inset-3 rounded-lg bg-slate-100/70 animate-pulse" />
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
      <div className={cn('space-y-4', fullHeight && 'h-full', className)}>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDays.map((day, index) => {
            const selected = isSameDay(day, currentDate);
            const today = isToday(day);
            const indicators = dayIndicators[index] || { hasSession: false, hasReminder: false };
            return (
              <button
                key={index}
                onClick={() => onDayClick?.(day)}
                className={`p-2 text-center rounded transition-colors flex flex-col items-center gap-1 ${
                  selected ? 'bg-primary text-primary-foreground' : today ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                }`}
              >
                <div className="text-xs font-medium">{format(day, 'EEE', { locale: dateFnsLocale })}</div>
                <div className="text-sm font-semibold">{format(day, 'd')}</div>
                <div className="flex h-3 items-center justify-center gap-1">
                  {indicators.hasSession && (
                    <span
                      className={cn("h-2 w-2 rounded-full", selected && "ring-2 ring-white")}
                      style={{ backgroundColor: '#17B2A9' }}
                      aria-hidden="true"
                    />
                  )}
                  {indicators.hasReminder && (
                    <span
                      className={cn("h-2 w-2 rounded-full", selected && "ring-2 ring-white")}
                      style={{ backgroundColor: '#7D8697' }}
                      aria-hidden="true"
                    />
                  )}
                </div>
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
                  const startMinutes = parseTimeToMinutes(session.session_time);
                  const computedDuration = session.duration_minutes ?? 60;
                  const endMinutes = startMinutes != null ? startMinutes + computedDuration : null;
                  const startLabel =
                    startMinutes != null
                      ? formatOrgTime(minutesToTimeString(startMinutes))
                      : t('calendar.labels.timeTbd', { defaultValue: 'Time TBD' });
                  const endLabel =
                    endMinutes != null
                      ? formatOrgTime(minutesToTimeString(endMinutes))
                      : null;
                  const timeLabel = endLabel ? `${startLabel} – ${endLabel}` : startLabel;
                  const durationLabel = session.duration_minutes != null
                    ? t('calendar.labels.durationMinutesShort', {
                        count: session.duration_minutes,
                        defaultValue: '{{count}} min'
                      })
                    : null;

                  return (
                    <button
                      key={session.id}
                      className="w-full p-4 bg-card rounded-lg border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      onClick={() => onSessionClick(session)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-primary mb-1">
                            {projectName || t('calendar.labels.session')}
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">{leadName}</div>
                          <div className="text-sm font-semibold text-foreground">
                            {timeLabel}
                            {durationLabel ? <span className="ml-1 text-muted-foreground text-xs">· {durationLabel}</span> : null}
                          </div>
                          {session.notes && (
                            <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {session.notes}
                            </div>
                          )}
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
                  const completionLabel = activity.completed
                    ? t('forms:reminders.markIncomplete', { defaultValue: 'Mark as not done' })
                    : t('forms:reminders.markComplete', { defaultValue: 'Mark as done' });
                  const toggleDisabled = completingReminderId === activity.id;

                  return (
                    <button
                      key={activity.id}
                      className={`relative w-full p-4 bg-card rounded-lg border hover:bg-accent/50 transition-colors text-left ${
                        activity.completed ? 'opacity-60' : ''
                      }`}
                      onClick={() => onActivityClick(activity)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium mb-1 ${activity.completed ? 'line-through' : ''}`}>
                            {activity.content}
                          </div>
                          <div className="text-sm text-muted-foreground mb-2 space-y-1">
                            <div>{`${t('calendar.labels.lead')}: ${leadName}`}</div>
                            {projectName ? <div>{`${t('calendar.labels.project')}: ${projectName}`}</div> : null}
                          </div>
                          <div className="text-sm font-medium">
                            {timeText}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {onToggleReminderCompletion && (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                onToggleReminderCompletion(activity, !activity.completed);
                              }}
                              disabled={toggleDisabled}
                              aria-pressed={activity.completed}
                              aria-label={completionLabel}
                              className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60',
                                activity.completed
                                  ? 'text-emerald-600'
                                  : 'text-slate-500 hover:text-primary'
                              )}
                            >
                              {toggleDisabled ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : activity.completed ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Circle className="h-5 w-5" />
                              )}
                            </button>
                          )}
                          {(activity.completed || shouldShowTypeBadge) && (
                            <div className={`px-2 py-1 text-xs rounded-md ${
                              activity.completed ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'
                            }`}>
                              {activity.completed ? t('calendar.labels.completed') : activity.type}
                            </div>
                          )}
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
              <p>{t('calendar.emptyStates.noEventsDay')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div
        className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        style={{ paddingRight: scrollbarPadding }}
      >
        <div className="px-3 py-2 text-right border-r border-slate-200/70">
          {t('forms:sessionScheduling.weekly_preview_time_column', { defaultValue: 'Time' })}
        </div>
        {weekDays.map((day, index) => {
          const today = isToday(day);
          return (
            <div
              key={index}
              className={cn(
                'border-l border-slate-200/70 px-3 py-2 text-center first:border-l-0 transition-colors',
                today && 'bg-emerald-50 text-emerald-700'
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide">
                {format(day, 'EEE', { locale: dateFnsLocale })}
              </div>
              <div
                className={cn(
                  'text-sm font-semibold text-slate-600',
                  today && 'text-emerald-700'
                )}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={scrollContainerRef}
        className={scrollContainerClassName}
        style={scrollContainerStyle}
      >
        <div ref={gridRef} className="relative">
          {timeSlots.map((slot, slotIndex) => {
            const isHour = slot.minute === 0;
            const isFirstRow = slotIndex === 0;
            const labelText = slot.display || '';
            const rowBorderClass = isFirstRow
              ? 'border-t border-slate-200/80'
              : isHour
              ? 'border-t border-dashed border-slate-200/70'
              : 'border-t border-slate-100/60';

            return (
              <div
                key={`slot-${slotIndex}`}
                className={cn(
                  'grid relative min-h-[48px]',
                  rowBorderClass
                )}
                style={{
                  gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))`,
                  minHeight: `${effectiveSlotHeight}px`,
                  height: `${effectiveSlotHeight}px`
                }}
              >
                <div
                  className={cn(
                    'sticky left-0 z-30 flex items-center justify-end border-r border-slate-200/70 bg-slate-50/60 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                    isFirstRow && 'border-t-0'
                  )}
                >
                  {isHour ? labelText : '\u00A0'}
                </div>

                {weekDays.map((day, dayIndex) => {
                  const today = isToday(day);
                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        'relative border-l border-slate-200/60 first:border-l-0 transition-colors',
                        today && 'bg-emerald-50/40'
                      )}
                    />
                  );
                })}
              </div>
            );
          })}

          {gridHeight > 0 && (
            <div
              className="pointer-events-none absolute inset-0 grid"
              style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
            >
              <div />
              {weekDays.map((day, dayIndex) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const layouts = eventLayoutsByDay.get(dayKey);
                const layoutSessions = layouts?.sessions ?? [];
                const layoutActivities = layouts?.activities ?? [];
                const today = isToday(day);
                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'relative pointer-events-none transition-colors',
                      today && 'bg-emerald-50/20'
                    )}
                    style={{ height: gridHeight }}
                  >
                    {showSessions &&
                      layoutSessions.map(({ entity: session, top, height, startMinutes, endMinutes, columnCount, columnIndex }) => {
                        const leadName = leadsMap[session.lead_id]?.name || t('calendar.labels.lead');
                        const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                        const startLabel = formatOrgTime(minutesToTimeString(startMinutes));
                        const endLabel = formatOrgTime(minutesToTimeString(endMinutes));
                        const dateLabel = format(day, 'PPP', { locale: dateFnsLocale });
                        const timeLabel = `${startLabel} – ${endLabel}`;
                        const locationLabel = session.location?.trim();
                        const safeColumnCount = columnCount > 0 ? columnCount : 1;
                        const widthPercent = 100 / safeColumnCount;
                        const leftPercent = widthPercent * columnIndex;
                        const isSingleColumn = safeColumnCount === 1;
                        const horizontalInset = isSingleColumn ? 4 : Math.min(2, widthPercent / 4);
                        const insetValue = horizontalInset.toFixed(3);
                        const leftValue = `calc(${leftPercent.toFixed(3)}% + ${insetValue}px)`;
                        const widthValue = `calc(${widthPercent.toFixed(3)}% - ${(horizontalInset * 2).toFixed(3)}px)`;
                        const sessionTitle =
                          session.session_name?.trim() ||
                          projectName ||
                          leadName ||
                          t('calendar.labels.session');
                        const tooltipDetails = [sessionTitle, projectName, leadName, locationLabel, timeLabel].filter(Boolean);
                        const ariaLabel = tooltipDetails.join(' • ');

                        return (
                          <Tooltip key={session.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="absolute z-20 pointer-events-auto overflow-hidden rounded-xl border border-emerald-300/80 bg-emerald-50 py-2 pl-3 pr-2 text-left text-[11px] text-emerald-900 shadow-[0_16px_28px_rgba(15,118,110,0.08)] transition-all hover:border-emerald-400 hover:bg-emerald-100/90 hover:shadow-[0_20px_34px_rgba(15,118,110,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                                style={{ top, height, left: leftValue, width: widthValue }}
                                onClick={() => onSessionClick(session)}
                                aria-label={ariaLabel}
                              >
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute bottom-1 left-0 top-1 w-[3px] rounded-full bg-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                                />
                                <div className="space-y-1 leading-snug">
                                  <p className="font-medium line-clamp-3">
                                    {projectName || t('calendar.labels.session')}
                                  </p>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                    {leadName}
                                  </p>
                                  {locationLabel ? (
                                    <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-700/90 truncate">
                                      <MapPin className="h-3 w-3" />
                                      <span className="truncate">{locationLabel}</span>
                                    </p>
                                  ) : null}
                                  <p className="text-[10px] font-medium text-emerald-600">
                                    {startLabel} – {endLabel}
                                  </p>
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs space-y-2 text-left text-sm leading-snug">
                              <div className="font-semibold text-foreground">
                                {sessionTitle}
                              </div>
                              <div className="space-y-1 text-foreground">
                                <p>
                                  {t('calendar.labels.lead')}: {leadName}
                                </p>
                                {projectName ? (
                                  <p>
                                    {t('calendar.labels.project')}: {projectName}
                                  </p>
                                ) : null}
                                {locationLabel ? (
                                  <p>
                                    {t('calendar.labels.location', { defaultValue: 'Location' })}: {locationLabel}
                                  </p>
                                ) : null}
                              </div>
                              <p className="font-medium text-foreground">
                                {dateLabel} • {timeLabel}
                              </p>
                              {session.notes ? (
                                <p className="text-muted-foreground">{session.notes}</p>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}

                    {showReminders &&
                      layoutActivities.map(({ entity: activity, top, height, startMinutes, columnCount, columnIndex, isAllDay }) => {
                        const leadName = leadsMap[activity.lead_id]?.name || t('calendar.labels.lead');
                        const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
                        const dateLabel = format(day, 'PPP', { locale: dateFnsLocale });
                        const startLabel = isAllDay
                          ? t('calendar.labels.allDay')
                          : formatOrgTime(minutesToTimeString(startMinutes));
                        const timeLabel = isAllDay ? t('calendar.labels.allDay') : startLabel;
                        const safeColumnCount = columnCount > 0 ? columnCount : 1;
                        const widthPercent = 100 / safeColumnCount;
                        const leftPercent = widthPercent * columnIndex;
                        const isSingleColumn = safeColumnCount === 1;
                        const horizontalInset = isSingleColumn ? 2 : Math.min(1.5, widthPercent / 6);
                        const insetValue = horizontalInset.toFixed(3);
                        const leftValue = `calc(${leftPercent.toFixed(3)}% + ${insetValue}px)`;
                        const widthValue = `calc(${widthPercent.toFixed(3)}% - ${(horizontalInset * 2).toFixed(3)}px)`;
                        const ariaLabel = [activity.content, projectName || leadName, timeLabel].filter(Boolean).join(' • ');
                        const toggleLabel = activity.completed
                          ? t('forms:reminders.markIncomplete', { defaultValue: 'Mark as not done' })
                          : t('forms:reminders.markComplete', { defaultValue: 'Mark as done' });
                        const isTogglingThisReminder = completingReminderId === activity.id;
                        const timeBadgeClass = cn(
                          'inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-semibold whitespace-nowrap',
                          activity.completed ? 'bg-slate-50 text-slate-400' : 'bg-slate-100 text-slate-600'
                        );

                        return (
                          <Tooltip key={activity.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  'absolute z-10 pointer-events-auto rounded-lg border px-2 py-2 text-left text-[11px] shadow-sm transition-colors',
                                  activity.completed
                                    ? 'border-slate-200 bg-slate-100 text-slate-400 line-through'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                )}
                                style={{ top, height, left: leftValue, width: widthValue }}
                                onClick={() => onActivityClick(activity)}
                                aria-label={ariaLabel}
                              >
                                {activity.completed ? (
                                  <span className="absolute -top-1.5 -right-1.5 text-emerald-500 drop-shadow-sm">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </span>
                                ) : null}
                                <div className="space-y-1 leading-snug">
                                  <p className="font-medium text-[11px] leading-tight line-clamp-2 break-words">
                                    {activity.content}
                                  </p>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                                      {leadName}
                                    </p>
                                    <span className={timeBadgeClass}>
                                      {activity.reminder_time ? startLabel : t('calendar.labels.allDay')}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs space-y-1 text-sm">
                              <p className="font-semibold text-foreground">{activity.content}</p>
                              <p className="text-foreground">
                                {t('calendar.labels.lead')}: {leadName}
                              </p>
                              {projectName ? (
                                <p className="text-foreground">
                                  {t('calendar.labels.project')}: {projectName}
                                </p>
                              ) : null}
                              <p className="text-foreground">
                                {dateLabel} • {timeLabel}
                              </p>
                              {onToggleReminderCompletion ? (
                                <div className="pt-2 mt-2 border-t border-slate-200">
                                  <button
                                    type="button"
                                    className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4 disabled:opacity-60"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      if (isTogglingThisReminder) return;
                                      onToggleReminderCompletion(activity, !activity.completed);
                                    }}
                                    disabled={isTogglingThisReminder}
                                  >
                                    {isTogglingThisReminder ? t('calendar.labels.updating', { defaultValue: 'Updating...' }) : toggleLabel}
                                  </button>
                                </div>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}

          {currentTimeIndicator && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 z-50"
              style={{ top: `${currentTimeIndicator.offset}px` }}
            >
              <div
                className="grid items-center"
                style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
              >
                <div className="sticky left-0 z-40 flex justify-end pr-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm">
                    {currentTimeIndicator.label}
                  </span>
                </div>
                <div className="col-span-7 relative flex items-center">
                  <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="h-0.5 w-full rounded-full bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]" />
                </div>
              </div>
            </div>
          )}
        </div>
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
    p.maxHeight === n.maxHeight &&
    p.fullHeight === n.fullHeight &&
    p.className === n.className &&
    p.completingReminderId === n.completingReminderId &&
    JSON.stringify(p.sessions) === JSON.stringify(n.sessions) &&
    JSON.stringify(p.activities) === JSON.stringify(n.activities)
  );
});
