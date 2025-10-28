import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MINUTES_IN_DAY = 24 * 60;
const PIXELS_PER_MINUTE = 0.9;
const MIN_BLOCK_HEIGHT = 36;
const MIN_VIEW_RANGE = 6 * 60;
const DEFAULT_DRAFT_DURATION = 60;

export interface WeeklyScheduleSession {
  id: string;
  session_date?: string | null;
  session_time?: string | null;
  duration_minutes?: number | null;
  session_type_name?: string | null;
  lead_name?: string | null;
  project_name?: string | null;
}

interface WeeklySchedulePreviewProps {
  sessions: WeeklyScheduleSession[];
  referenceDate: Date;
  selectedDate?: Date;
  selectedTime?: string;
  selectedDurationMinutes?: number | null;
  locale?: string;
}

interface PositionedSession extends WeeklyScheduleSession {
  startMinutes: number;
  endMinutes: number;
  columnIndex: number;
  columnCount: number;
  dayIndex: number;
}

const formatTimeLabel = (minutes: number, locale: string) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const reference = new Date();
  reference.setHours(hours, mins, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(reference);
};

const formatDurationLabel = (
  minutes: number,
  translate: (key: string, options?: Record<string, unknown>) => string
) => {
  const roundedMinutes = Math.max(Math.round(minutes), 0);
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    const unitKey =
      hours === 1 ? "sessionTypes.units.hour" : "sessionTypes.units.hours";
    parts.push(`${hours} ${translate(unitKey)}`);
  }

  if (remainingMinutes > 0 || parts.length === 0) {
    const unitKey =
      remainingMinutes === 1
        ? "sessionTypes.units.minute"
        : "sessionTypes.units.minutes";
    parts.push(`${remainingMinutes} ${translate(unitKey)}`);
  }

  return parts.join(" ");
};

const parseTimeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map((part) => Number(part) || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const buildDayLayout = (
  sessions: Array<WeeklyScheduleSession & { startMinutes: number; endMinutes: number }>
): PositionedSession[] => {
  const sorted = [...sessions].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
  );

  const active: Array<{
    columnIndex: number;
    endMinutes: number;
    positioned: PositionedSession;
  }> = [];
  const positioned: PositionedSession[] = [];

  sorted.forEach((session) => {
    const { startMinutes, endMinutes } = session;

    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].endMinutes <= startMinutes) {
        active.splice(i, 1);
      }
    }

    const usedColumns = new Set(active.map((item) => item.columnIndex));
    let columnIndex = 0;
    while (usedColumns.has(columnIndex)) {
      columnIndex += 1;
    }

    const positionedSession: PositionedSession = {
      ...session,
      columnIndex,
      columnCount: 1,
      id: session.id,
      dayIndex: 0,
    };

    active.push({ columnIndex, endMinutes, positioned: positionedSession });
    active.sort((a, b) => a.endMinutes - b.endMinutes);

    const overlapColumns = active.length;
    active.forEach((item) => {
      item.positioned.columnCount = Math.max(item.positioned.columnCount, overlapColumns);
    });

    positioned.push(positionedSession);
  });

  return positioned;
};

const clampRange = (start: number, end: number): { start: number; end: number } => {
  let rangeStart = Math.max(0, start);
  let rangeEnd = Math.min(MINUTES_IN_DAY, end);
  if (rangeEnd <= rangeStart) {
    rangeStart = 9 * 60;
    rangeEnd = rangeStart + MIN_VIEW_RANGE;
  }
  if (rangeEnd - rangeStart < MIN_VIEW_RANGE) {
    const deficit = MIN_VIEW_RANGE - (rangeEnd - rangeStart);
    const adjustStart = Math.max(0, rangeStart - deficit / 2);
    const adjustEnd = Math.min(MINUTES_IN_DAY, adjustStart + MIN_VIEW_RANGE);
    rangeStart = Math.max(0, adjustEnd - MIN_VIEW_RANGE);
    rangeEnd = adjustEnd;
  }
  return { start: rangeStart, end: rangeEnd };
};

export const WeeklySchedulePreview = ({
  sessions,
  referenceDate,
  selectedDate,
  selectedTime,
  selectedDurationMinutes,
  locale = typeof navigator !== "undefined" ? navigator.language : "en-US",
}: WeeklySchedulePreviewProps) => {
  const { t } = useFormsTranslation();

  const weekStart = useMemo(
    () => startOfWeek(referenceDate, { weekStartsOn: 1 }),
    [referenceDate]
  );

  const selectedDayIndex = useMemo(() => {
    if (!selectedDate) return null;
    return differenceInCalendarDays(selectedDate, weekStart);
  }, [selectedDate, weekStart]);

  const draftStartMinutes = useMemo(
    () => parseTimeToMinutes(selectedTime),
    [selectedTime]
  );

  const draftDurationMinutes = useMemo(() => {
    if (typeof selectedDurationMinutes === "number" && selectedDurationMinutes > 0) {
      return Math.min(selectedDurationMinutes, MINUTES_IN_DAY);
    }
    return DEFAULT_DRAFT_DURATION;
  }, [selectedDurationMinutes]);

  const isDraftWithinWeek =
    selectedDayIndex !== null &&
    selectedDayIndex >= 0 &&
    selectedDayIndex <= 6 &&
    draftStartMinutes !== null;

  const draftEndMinutes = isDraftWithinWeek
    ? Math.min(draftStartMinutes! + draftDurationMinutes, MINUTES_IN_DAY - 1)
    : null;

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        date: addDays(weekStart, index),
        index,
      })),
    [weekStart]
  );

  const { dayLayouts, daySessionsMap, noTimeSessions, viewWindow } = useMemo(() => {
    const dayMap = new Map<number, Array<WeeklyScheduleSession & { startMinutes: number; endMinutes: number }>>();
    const noTimeMap = new Map<number, WeeklyScheduleSession[]>();
    const startCandidates: number[] = [];
    const endCandidates: number[] = [];

    sessions.forEach((session) => {
      if (!session.session_date) return;
      const parsedDate = parseISO(session.session_date);
      if (Number.isNaN(parsedDate.getTime())) return;
      const dayIndex = differenceInCalendarDays(parsedDate, weekStart);
      if (dayIndex < 0 || dayIndex > 6) return;

    const startMinutes = parseTimeToMinutes(session.session_time);
    const durationMinutes =
      typeof session.duration_minutes === "number" && session.duration_minutes > 0
        ? session.duration_minutes
        : 60;
    const safeEnd = startMinutes !== null ? startMinutes + durationMinutes : null;

      if (startMinutes === null || safeEnd === null) {
        const existing = noTimeMap.get(dayIndex) ?? [];
        noTimeMap.set(dayIndex, [...existing, session]);
        return;
      }

      const normalized = {
        ...session,
        startMinutes,
        endMinutes: safeEnd,
        duration_minutes: durationMinutes,
      };

      const daySessions = dayMap.get(dayIndex) ?? [];
      dayMap.set(dayIndex, [...daySessions, normalized]);
      startCandidates.push(startMinutes);
      endCandidates.push(safeEnd);
    });

    if (isDraftWithinWeek && draftStartMinutes !== null && draftEndMinutes !== null) {
      startCandidates.push(draftStartMinutes);
      endCandidates.push(draftEndMinutes);
    }

    const rawStart = startCandidates.length ? Math.min(...startCandidates) : 9 * 60;
    const rawEnd = endCandidates.length ? Math.max(...endCandidates) : 17 * 60;
    const viewWindow = clampRange(rawStart, rawEnd);

    const layoutsByDay = new Map<number, PositionedSession[]>();
    dayMap.forEach((daySessions, dayIndex) => {
      const layouts = buildDayLayout(daySessions).map((session) => ({
        ...session,
        dayIndex,
      }));
      layoutsByDay.set(dayIndex, layouts);
    });

    return {
      dayLayouts: layoutsByDay,
      daySessionsMap: dayMap,
      noTimeSessions: noTimeMap,
      viewWindow,
    };
  }, [
    draftEndMinutes,
    draftStartMinutes,
    isDraftWithinWeek,
    sessions,
    weekStart,
  ]);

  const containerHeight = (viewWindow.end - viewWindow.start) * PIXELS_PER_MINUTE;
  const hourMarkers = useMemo(() => {
    const markers: Array<{ label: string; minute: number }> = [];
    if (viewWindow.end <= viewWindow.start) {
      return markers;
    }
    const firstMarker = Math.ceil(viewWindow.start / 60) * 60;
    if (firstMarker > viewWindow.end) {
      return markers;
    }
    for (let minute = firstMarker; minute <= viewWindow.end; minute += 60) {
      markers.push({
        label: formatTimeLabel(minute, locale),
        minute,
      });
    }
    return markers;
  }, [viewWindow.end, viewWindow.start, locale]);

  const hasDraftSelection = Boolean(isDraftWithinWeek);

  if (!sessions.length && !hasDraftSelection) {
    return (
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6 text-sm text-muted-foreground">
        {t("sessionScheduling.weekly_preview_empty")}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">
          {t("sessionScheduling.weekly_preview_heading")}
        </h3>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b bg-slate-50/70 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div className="px-3 py-2">{t("sessionScheduling.weekly_preview_time_column")}</div>
          {days.map(({ date, index }) => (
            <div
              key={index}
              className={cn(
                "border-l px-3 py-2 text-center first:border-l-0",
                selectedDayIndex === index && "bg-primary/10 text-primary"
              )}
            >
              <div>{new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)}</div>
              <div className="text-[11px] font-semibold text-slate-600">
                {new Intl.DateTimeFormat(locale, {
                  day: "2-digit",
                  month: "2-digit",
                }).format(date)}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
          <div className="relative border-r bg-slate-50/40">
            <div
              className="relative"
              style={{ height: `${containerHeight}px` }}
            >
              {hourMarkers.map((marker) => {
                const offset = (marker.minute - viewWindow.start) * PIXELS_PER_MINUTE;
                return (
                  <div
                    key={marker.minute}
                    data-testid="weekly-hour-marker"
                    className="absolute left-0 right-0 flex items-center justify-end pr-2 text-[11px] text-muted-foreground"
                    style={{ top: `${offset}px` }}
                  >
                    {marker.label}
                  </div>
                );
              })}
          </div>
        </div>
          {days.map(({ index }) => {
            const baseDaySessions = dayLayouts.get(index) ?? [];
            const rawDaySessions = daySessionsMap.get(index) ?? [];
            const dayNoTime = noTimeSessions.get(index) ?? [];
            const draftStart = draftStartMinutes ?? 0;
            const draftEnd = draftEndMinutes ?? draftStart;
            const showDraftSelection =
              hasDraftSelection &&
              selectedDayIndex === index &&
              draftStartMinutes !== null &&
              draftEndMinutes !== null;

            let renderedSessions = baseDaySessions;
            let draftLayout: PositionedSession | null = null;

            if (showDraftSelection) {
              const draftSession: WeeklyScheduleSession & {
                startMinutes: number;
                endMinutes: number;
              } = {
                id: "__draft__",
                session_time: selectedTime ?? null,
                duration_minutes: draftDurationMinutes,
                startMinutes: draftStart,
                endMinutes: draftEnd,
              };

              const layoutWithDraft = buildDayLayout([
                ...rawDaySessions,
                draftSession,
              ]).map((session) => ({
                ...session,
                dayIndex: index,
              }));

              draftLayout =
                layoutWithDraft.find((session) => session.id === draftSession.id) ??
                null;

              renderedSessions = layoutWithDraft.filter(
                (session) => session.id !== draftSession.id
              );
            }

            const draftBlockMetrics = showDraftSelection
              ? (() => {
                  const top =
                    (draftStart - viewWindow.start) * PIXELS_PER_MINUTE;
                  const height = Math.max(
                    (draftEnd - draftStart) * PIXELS_PER_MINUTE,
                    MIN_BLOCK_HEIGHT
                  );
                  const columnCount =
                    draftLayout?.columnCount && draftLayout.columnCount > 0
                      ? draftLayout.columnCount
                      : 1;
                  const columnIndex =
                    draftLayout?.columnIndex && draftLayout.columnIndex >= 0
                      ? draftLayout.columnIndex
                      : 0;
                  const widthPercent = 100 / columnCount;
                  const leftPercent = (columnIndex * widthPercent).toFixed(3);
                  const widthValue = widthPercent.toFixed(3);
                  const gutter = columnCount > 1 ? 1 : 0;

                  return {
                    top,
                    height,
                    left: `calc(${leftPercent}% + ${gutter}px)`,
                    width: `calc(${widthValue}% - ${gutter * 2}px)`,
                    startLabel: formatTimeLabel(draftStart, locale),
                    endLabel: formatTimeLabel(draftEnd, locale),
                  };
                })()
              : null;

            return (
              <div
                key={index}
                className={cn(
                  "relative border-l first:border-l-0",
                  selectedDayIndex === index && "bg-primary/5"
                )}
              >
                <div
                  className="relative"
                  style={{ height: `${containerHeight}px` }}
                >
                  {hourMarkers.map((marker) => {
                    const offset = (marker.minute - viewWindow.start) * PIXELS_PER_MINUTE;
                    return (
                      <div
                        key={marker.minute}
                        className="absolute left-0 right-0 border-t border-dashed border-slate-200/70"
                        style={{ top: `${offset}px` }}
                        aria-hidden="true"
                      />
                    );
                  })}
                  {draftBlockMetrics ? (
                    <div
                      data-testid="weekly-draft-selection"
                      aria-hidden="true"
                      className="pointer-events-none absolute flex flex-col items-stretch text-center"
                      style={{
                        top: `${draftBlockMetrics.top}px`,
                        left: draftBlockMetrics.left,
                        width: draftBlockMetrics.width,
                      }}
                    >
                      <div
                        className="rounded-xl border border-dashed border-amber-400/80 bg-amber-50/90 px-1.5 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-900 shadow-none"
                        style={{ height: `${draftBlockMetrics.height}px` }}
                      >
                        <div className="text-[11px] capitalize tracking-normal">
                          {draftBlockMetrics.startLabel} – {draftBlockMetrics.endLabel}
                        </div>
                      </div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        {t("sessionScheduling.weekly_preview_draft_label")}
                      </div>
                    </div>
                  ) : null}
                  {renderedSessions.map((session) => {
                    const topOffset =
                      (session.startMinutes - viewWindow.start) * PIXELS_PER_MINUTE;
                    const blockHeight = Math.max(
                      (session.endMinutes - session.startMinutes) * PIXELS_PER_MINUTE,
                      MIN_BLOCK_HEIGHT
                    );
                    const widthPercent = 100 / session.columnCount;
                    const leftOffset = (session.columnIndex * widthPercent).toFixed(3);
                    const widthValue = widthPercent.toFixed(3);
                    const startLabel = formatTimeLabel(session.startMinutes, locale);
                    const endLabel = formatTimeLabel(session.endMinutes, locale);
                    const durationMinutes =
                      typeof session.duration_minutes === "number"
                        ? Math.max(session.duration_minutes, 0)
                        : undefined;
                    const formattedDuration =
                      durationMinutes !== undefined
                        ? formatDurationLabel(durationMinutes, t)
                        : undefined;
                    const gutter = session.columnCount > 1 ? 1 : 0;
                    const tooltipDetails = [
                      session.lead_name || t("sessionScheduling.unknown_client"),
                      session.project_name,
                      session.session_type_name && formattedDuration
                        ? `${session.session_type_name} • ${formattedDuration}`
                        : formattedDuration,
                      `${startLabel} – ${endLabel}`,
                    ].filter(Boolean);
                    const ariaLabel = tooltipDetails.join(" • ");

                    return (
                      <Tooltip key={session.id}>
                        <TooltipTrigger asChild>
                          <div
                            data-testid={`weekly-session-${session.id}`}
                            aria-label={ariaLabel}
                            className={cn(
                              "absolute overflow-hidden rounded-xl border border-emerald-300/80 bg-emerald-50 px-1.5 py-1.5 text-left shadow-[0_16px_28px_rgba(15,118,110,0.08)] transition-all",
                              "hover:border-emerald-400 hover:bg-emerald-100/90 hover:shadow-[0_20px_34px_rgba(15,118,110,0.15)]"
                            )}
                            style={{
                              top: `${topOffset}px`,
                              height: `${blockHeight}px`,
                              left: `calc(${leftOffset}% + ${gutter}px)`,
                              width: `calc(${widthValue}% - ${gutter * 2}px)`,
                            }}
                          >
                            <p className="flex-1 break-all text-[11px] font-light leading-snug text-slate-800 line-clamp-6">
                              {session.lead_name || t("sessionScheduling.unknown_client")}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs space-y-1 text-left text-sm leading-snug">
                          <div className="font-medium text-emerald-900">
                            {session.lead_name || t("sessionScheduling.unknown_client")}
                          </div>
                          {session.project_name ? (
                            <div className="text-emerald-800">{session.project_name}</div>
                          ) : null}
                          {formattedDuration ? (
                            <div className="text-muted-foreground">
                              {session.session_type_name
                                ? `${session.session_type_name} • ${formattedDuration}`
                                : formattedDuration}
                            </div>
                          ) : null}
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {startLabel} – {endLabel}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                {dayNoTime.length > 0 && (
                  <div className="border-t border-dashed border-slate-200 bg-slate-50/80 px-2 py-2 text-[11px] text-muted-foreground">
                    <div className="font-semibold uppercase tracking-wide">
                      {t("sessionScheduling.weekly_preview_time_tbd")}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {dayNoTime.map((session) => (
                        <li key={session.id}>
                          {session.lead_name || t("sessionScheduling.unknown_client")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export const __testUtils = {
  PIXELS_PER_MINUTE,
  MIN_BLOCK_HEIGHT,
  clampRange,
  parseTimeToMinutes,
};
