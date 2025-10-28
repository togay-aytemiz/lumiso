import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { getUserLocale, formatLongDate } from "@/lib/utils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { format } from "date-fns";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

interface CalendarTimePickerProps {
  selectedDate?: Date;
  selectedTime: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  onDateStringChange: (dateString: string) => void;
}

export function CalendarTimePicker({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  onDateStringChange
}: CalendarTimePickerProps) {
  const { t } = useFormsTranslation();
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [plannedSessions, setPlannedSessions] = useState<any[]>([]);
  const browserLocale = getUserLocale();
  const plannedSessionsRef = useRef<HTMLDivElement | null>(null);
  const previousSelectedKeyRef = useRef<string | undefined>();

  const fetchPlannedSessions = async (month: Date) => {
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
          lead_id,
          project_id,
          leads:lead_id (name),
          projects:project_id (name),
          status
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'planned')
        .gte('session_date', format(start, 'yyyy-MM-dd'))
        .lte('session_date', format(end, 'yyyy-MM-dd'));

      if (error) throw error;
      setPlannedSessions(data || []);
    } catch (err) {
      console.error('Failed to fetch planned sessions for calendar:', err);
      // Don't crash on mobile, just show empty state
      setPlannedSessions([]);
    }
  };

  useEffect(() => {
    fetchPlannedSessions(visibleMonth);
  }, [visibleMonth]);

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : "";
  const sessionsForDay = selectedKey ? (plannedSessions || []).filter((s: any) => s.session_date === selectedKey) : [];

  const sortedSessionsForDay = useMemo(() => {
    const toMinutes = (t: string | null | undefined) => {
      if (!t) return Number.POSITIVE_INFINITY;
      const parts = t.split(':');
      const h = parseInt(parts[0] || '0', 10);
      const m = parseInt(parts[1] || '0', 10);
      return h * 60 + m;
    };
    return [...sessionsForDay].sort((a: any, b: any) => toMinutes(a.session_time) - toMinutes(b.session_time));
  }, [sessionsForDay]);

  const sessionCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    (plannedSessions || []).forEach((s: any) => {
      if (!s.session_date) return;
      map[s.session_date] = (map[s.session_date] || 0) + 1;
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

  return (
    <div className="space-y-6">
      {(selectedDate || selectedTime) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 p-4">
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

      {sessionsForDay.length > 0 && (
        <div ref={plannedSessionsRef} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" />
            {t("sessionScheduling.planned_sessions_on")}{" "}
            {selectedDate ? formatLongDate(selectedDate, browserLocale) : t("sessionScheduling.this_day")}
          </div>
          <div className="overflow-hidden rounded-lg border divide-y">
            {sortedSessionsForDay.map((s: any, index: number) => {
              const timeLabel = s.session_time
                ? new Intl.DateTimeFormat(browserLocale, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: undefined
                }).format(new Date(`2000-01-01T${s.session_time}`))
                : t("sessionScheduling.no_time");

              return (
                <div
                  key={s.id ?? `${selectedKey}-${index}`}
                  className="flex items-center gap-4 px-4 py-2 text-sm"
                >
                  <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                    {timeLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {s.leads?.name || t("sessionScheduling.unknown_client")}
                    </div>
                    {s.projects?.name && (
                      <div className="truncate text-xs text-muted-foreground">
                        {s.projects.name}
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
