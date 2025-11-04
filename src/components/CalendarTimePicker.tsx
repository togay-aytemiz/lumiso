import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { getUserLocale, formatLongDate } from "@/lib/utils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import {
  WeeklySchedulePreview,
  WeeklyScheduleSession,
} from "./WeeklySchedulePreview";

interface PlannedSessionRecord {
  id: string;
  session_date?: string | null;
  session_time?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
  leads?: { name?: string | null } | null;
  projects?: { name?: string | null } | null;
  status?: string | null;
  session_type_id?: string | null;
  session_types?: { duration_minutes?: number | null; name?: string | null } | null;
}

interface CalendarTimePickerProps {
  selectedDate?: Date;
  selectedTime: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  onDateStringChange: (dateString: string) => void;
  selectedSessionDurationMinutes?: number | null;
  enableDraftPreview?: boolean;
}

export function CalendarTimePicker({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  onDateStringChange,
  selectedSessionDurationMinutes,
  enableDraftPreview = true,
}: CalendarTimePickerProps) {
  const { t } = useFormsTranslation();
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [plannedSessions, setPlannedSessions] = useState<PlannedSessionRecord[]>([]);
  const browserLocale = getUserLocale();
  const plannedSessionsRef = useRef<HTMLDivElement | null>(null);
  const previousSelectedKeyRef = useRef<string | undefined>();

  const fetchPlannedSessions = useCallback(async (month: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          session_date,
          session_time,
          session_type_id,
          lead_id,
          project_id,
          leads:lead_id (name),
          projects:project_id (name),
          status,
          session_types:session_type_id (duration_minutes, name)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'planned')
        .gte('session_date', format(start, 'yyyy-MM-dd'))
        .lte('session_date', format(end, 'yyyy-MM-dd'));

      if (error) throw error;
      setPlannedSessions((data ?? []) as PlannedSessionRecord[]);
    } catch (error) {
      console.error('Failed to fetch planned sessions for calendar:', error);
      // Don't crash on mobile, just show empty state
      setPlannedSessions([]);
    }
  }, []);

  useEffect(() => {
    void fetchPlannedSessions(visibleMonth);
  }, [fetchPlannedSessions, visibleMonth]);

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : "";

  const sessionsForDay = useMemo(() => {
    if (!selectedKey) {
      return [] as PlannedSessionRecord[];
    }
    return plannedSessions.filter((session) => session.session_date === selectedKey);
  }, [plannedSessions, selectedKey]);

  const sortedSessionsForDay = useMemo(() => {
    const toMinutes = (time: string | null | undefined) => {
      if (!time) return Number.POSITIVE_INFINITY;
      const parts = time.split(':');
      const hours = parseInt(parts[0] || '0', 10);
      const minutes = parseInt(parts[1] || '0', 10);
      return hours * 60 + minutes;
    };
    return [...sessionsForDay].sort(
      (a, b) => toMinutes(a.session_time) - toMinutes(b.session_time)
    );
  }, [sessionsForDay]);

  const sessionCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    plannedSessions.forEach((session) => {
      if (!session.session_date) return;
      map[session.session_date] = (map[session.session_date] || 0) + 1;
    });
    return map;
  }, [plannedSessions]);

  useEffect(() => {
    if (
      selectedKey &&
      previousSelectedKeyRef.current !== selectedKey &&
      sessionsForDay.length > 0 &&
      plannedSessionsRef.current
    ) {
      plannedSessionsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    previousSelectedKeyRef.current = selectedKey;
  }, [selectedKey, sessionsForDay.length]);

  const weeklyReferenceDate = selectedDate ?? visibleMonth;

  const weeklySessions = useMemo<WeeklyScheduleSession[]>(() => {
    const weekStart = startOfWeek(weeklyReferenceDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);

    return plannedSessions.reduce<WeeklyScheduleSession[]>((acc, session) => {
      if (!session.session_date) {
        return acc;
      }

      const parsed = parseISO(session.session_date);
      if (Number.isNaN(parsed.getTime())) {
        return acc;
      }

      if (parsed < weekStart || parsed >= weekEnd) {
        return acc;
      }

      acc.push({
        id: session.id,
        session_date: session.session_date,
        session_time: session.session_time,
        duration_minutes: session.session_types?.duration_minutes ?? undefined,
        session_type_name: session.session_types?.name ?? undefined,
        lead_name: session.leads?.name ?? undefined,
        project_name: session.projects?.name ?? undefined,
      });

      return acc;
    }, []);
  }, [plannedSessions, weeklyReferenceDate]);

  return (
    <div className="space-y-6">
      {(selectedDate || selectedTime) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 p-4">
          {selectedDate && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25m3 7.5v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18.75v-6m15 0V9a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9v6.75m15 0H3" />
              </svg>
              <span className="text-sm font-medium">
                {formatLongDate(selectedDate, browserLocale)}
              </span>
            </div>
          )}
          {selectedTime && (
            <div className="flex items-center gap-2 rounded-md border border-secondary/20 bg-secondary/10 px-3 py-1.5 text-secondary-foreground">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">
                {new Intl.DateTimeFormat(browserLocale, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: undefined
                }).format(new Date(`2000-01-01T${selectedTime}`))}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="rounded-xl border bg-background p-4">
          <ReactCalendar
            className="react-calendar !w-full pointer-events-auto [&_.react-calendar__navigation]:!w-full [&_.react-calendar__viewContainer]:!w-full [&_.react-calendar__month-view]:!w-full"
            locale={browserLocale}
            view="month"
            minDetail="month"
            next2Label={null}
            prev2Label={null}
            onActiveStartDateChange={({ activeStartDate, view }) => {
              try {
                if (view === "month" && activeStartDate) {
                  setVisibleMonth(activeStartDate);
                }
              } catch (err) {
                console.error("Calendar navigation error:", err);
              }
            }}
            onChange={(value) => {
              try {
                const d = Array.isArray(value) ? value[0] : value;
                const date = d instanceof Date ? d : undefined;
                onDateChange(date);
                if (date) {
                  onDateStringChange(format(date, "yyyy-MM-dd"));
                }
              } catch (err) {
                console.error("Date selection error:", err);
              }
            }}
            value={selectedDate ?? null}
            formatShortWeekday={(_, date) => new Intl.DateTimeFormat(browserLocale, { weekday: "short" }).format(date)}
            tileContent={({ date, view }) => {
              if (view !== "month") return null;
              const key = format(date, "yyyy-MM-dd");
              const count = sessionCountByDate[key] || 0;
              const dots = Math.min(count, 3);
              if (!dots) return null;
              return (
                <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5">
                  {Array.from({ length: dots }).map((_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
                  ))}
                </div>
              );
            }}
          />
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={() => {
                const today = new Date();
                onDateChange(today);
                onDateStringChange(format(today, "yyyy-MM-dd"));
              }}
            >
              {t("buttons.today")}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4 min-h-[320px]">
          <TimeSlotPicker
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onTimeSelect={onTimeChange}
          />
        </div>
      </div>

      <WeeklySchedulePreview
        sessions={weeklySessions}
        referenceDate={weeklyReferenceDate}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        selectedDurationMinutes={selectedSessionDurationMinutes}
        showDraftSelection={enableDraftPreview}
        locale={browserLocale}
      />

      {sessionsForDay.length > 0 && (
        <div ref={plannedSessionsRef} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" />
            {t("sessionScheduling.planned_sessions_on")}{" "}
            {selectedDate ? formatLongDate(selectedDate, browserLocale) : t("sessionScheduling.this_day")}
          </div>
          <div className="overflow-hidden rounded-lg border divide-y">
            {sortedSessionsForDay.map((session, index) => {
              const timeLabel = session.session_time
                ? new Intl.DateTimeFormat(browserLocale, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: undefined
                }).format(new Date(`2000-01-01T${session.session_time}`))
                : t("sessionScheduling.no_time");

              return (
                <div
                  key={session.id ?? `${selectedKey}-${index}`}
                  className="flex items-center gap-4 px-4 py-2 text-sm"
                >
                  <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                    {timeLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {session.leads?.name || t("sessionScheduling.unknown_client")}
                    </div>
                    {session.projects?.name && (
                      <div className="truncate text-xs text-muted-foreground">
                        {session.projects.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
