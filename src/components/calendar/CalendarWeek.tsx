import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import { getUserLocale, getStartOfWeek, getDateFnsLocale, cn } from '@/lib/utils';
import { useSmartTimeRange } from '@/hooks/useSmartTimeRange';
import { useOrganizationTimezone } from '@/hooks/useOrganizationTimezone';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
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
  leadsMap: Record<string, { id: string; name: string }>;
  projectsMap: Record<string, { id: string; name: string; lead_id: string }>;
  isMobile: boolean;
  getEventsForDate: (date: Date) => { sessions: Session[]; activities: Activity[] };
  onSessionClick: (session: Session) => void;
  onActivityClick: (activity: Activity) => void;
  onDayClick?: (date: Date) => void;
}

const TIME_COL_PX = 72;

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
  onDayClick
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
  const effectiveSlotHeight = slotHeight || 32; // fallback to base cell height until measured

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
  const eventSlotCount = eventsByDayAndSlot.size;
  const currentDateTimestamp = currentDate.getTime();
  const containerMaxHeight = useMemo(() => {
    if (typeof maxHeight === 'number') return `${maxHeight}px`;
    return maxHeight ?? '60vh';
  }, [maxHeight]);

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

    const updatePadding = () => {
      const target = scrollContainerRef.current;
      if (!target) return;
      const offsetWidth = target.offsetWidth;
      const clientWidth = target.clientWidth;
      const nextPadding = Math.max(0, offsetWidth - clientWidth);
      setScrollbarPadding(current => (current !== nextPadding ? nextPadding : current));
    };

    updatePadding();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updatePadding());
      observer.observe(container);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updatePadding);
      return () => window.removeEventListener('resize', updatePadding);
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
        const clampedEnd = Math.min(clampedStart + 30, rangeEndMinutes);

        if (clampedEnd <= rangeStartMinutes || clampedStart >= rangeEndMinutes) {
          return;
        }

        const topMinutes = clampedStart - rangeStartMinutes;
        const heightMinutes = clampedEnd - clampedStart || 30;

        activityLayouts.push({
          entity: activity,
          top: minutesToPixels(topMinutes),
          height: Math.max(minVisualHeight * 0.6, minutesToPixels(heightMinutes)),
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
  }, [effectiveSlotHeight, getEventsForDate, rangeEndMinutes, rangeStartMinutes, timeSlots.length, weekDays]);

  // loading skeleton that uses the same grid template to avoid layout jump
  if (timezoneLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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

        <div className="overflow-y-auto" style={{ maxHeight: containerMaxHeight }}>
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
        className="overflow-y-auto relative"
        style={{ maxHeight: containerMaxHeight }}
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
                style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}
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
                        const safeColumnCount = columnCount > 0 ? columnCount : 1;
                        const widthPercent = 100 / safeColumnCount;
                        const leftPercent = widthPercent * columnIndex;
                        const isSingleColumn = safeColumnCount === 1;
                        const horizontalInset = isSingleColumn ? 4 : Math.min(2, widthPercent / 4);
                        const insetValue = horizontalInset.toFixed(3);
                        const leftValue = `calc(${leftPercent.toFixed(3)}% + ${insetValue}px)`;
                        const widthValue = `calc(${widthPercent.toFixed(3)}% - ${(horizontalInset * 2).toFixed(3)}px)`;
                        const sessionTitle =
                          session.session_name ||
                          session.status ||
                          projectName ||
                          t('calendar.labels.session');
                        const tooltipDetails = [sessionTitle, leadName, timeLabel].filter(Boolean);
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
                                  <p className="text-[10px] font-medium text-emerald-600">
                                    {startLabel} – {endLabel}
                                  </p>
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs space-y-1 text-sm">
                              <p className="font-semibold text-foreground">
                                {sessionTitle}
                              </p>
                              <p className="text-foreground">
                                {t('calendar.labels.lead')}: {leadName}
                              </p>
                              {projectName ? (
                                <p className="text-foreground">
                                  {t('calendar.labels.project')}: {projectName}
                                </p>
                              ) : null}
                              {session.location ? (
                                <p className="text-foreground">
                                  {t('calendar.labels.location', { defaultValue: 'Location' })}: {session.location}
                                </p>
                              ) : null}
                              <p className="text-foreground">
                                {dateLabel} • {timeLabel}
                              </p>
                              {session.notes ? <div className="h-px bg-slate-200 my-2" /> : null}
                              {session.notes ? (
                                <p className="text-foreground">{session.notes}</p>
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
                        const horizontalInset = isSingleColumn ? 4 : Math.min(2, widthPercent / 4);
                        const insetValue = horizontalInset.toFixed(3);
                        const leftValue = `calc(${leftPercent.toFixed(3)}% + ${insetValue}px)`;
                        const widthValue = `calc(${widthPercent.toFixed(3)}% - ${(horizontalInset * 2).toFixed(3)}px)`;
                        const ariaLabel = [activity.content, projectName || leadName, timeLabel].filter(Boolean).join(' • ');

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
                                <div className="space-y-1 leading-snug">
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <p className="flex-1 min-w-0 font-medium line-clamp-1">{activity.content}</p>
                                    <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                                      {activity.reminder_time ? startLabel : t('calendar.labels.allDay')}
                                    </span>
                                  </div>
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                                    {projectName || leadName}
                                  </p>
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
    JSON.stringify(p.sessions) === JSON.stringify(n.sessions) &&
    JSON.stringify(p.activities) === JSON.stringify(n.activities)
  );
});
