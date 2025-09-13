import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { getUserLocale, formatLongDate } from "@/lib/utils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { format } from "date-fns";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";

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
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [plannedSessions, setPlannedSessions] = useState<any[]>([]);
  const browserLocale = getUserLocale();

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

  return (
    <div className="space-y-4">
      {/* Selected Date & Time Display */}
      {(selectedDate || selectedTime) && (
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedDate && selectedTime ? (
              `${formatLongDate(selectedDate, browserLocale)} - ${new Intl.DateTimeFormat(browserLocale, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: undefined
              }).format(new Date(`2000-01-01T${selectedTime}`))}`
            ) : selectedDate ? (
              formatLongDate(selectedDate, browserLocale)
            ) : selectedTime ? (
              `Selected time: ${new Intl.DateTimeFormat(browserLocale, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: undefined
              }).format(new Date(`2000-01-01T${selectedTime}`))}`
            ) : null}
          </Badge>
        </div>
      )}
      
      {/* Combined Date & Time Selection */}
      <div className="rounded-lg border p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date Picker */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Date</Label>
            <div className="rounded-lg border">
              <div className="p-3">
                <ReactCalendar
                  className="react-calendar !w-full pointer-events-auto [&_.react-calendar\_\_navigation]:!w-full [&_.react-calendar\_\_viewContainer]:!w-full [&_.react-calendar\_\_month-view]:!w-full"
                  locale={browserLocale}
                  view="month"
                  minDetail="month"
                  next2Label={null}
                  prev2Label={null}
                  onActiveStartDateChange={({ activeStartDate, view }) => {
                    if (view === 'month' && activeStartDate) {
                      setVisibleMonth(activeStartDate);
                    }
                  }}
                  onChange={(value) => {
                    const d = Array.isArray(value) ? value[0] : value;
                    const date = d instanceof Date ? d : undefined;
                    onDateChange(date);
                    if (date) {
                      onDateStringChange(format(date, "yyyy-MM-dd"));
                    }
                  }}
                  value={selectedDate ?? null}
                  formatShortWeekday={(_, date) => new Intl.DateTimeFormat(browserLocale, { weekday: 'short' }).format(date)}
                  tileContent={({ date, view }) => {
                    if (view !== 'month') return null;
                    const key = format(date, 'yyyy-MM-dd');
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
              </div>
              <div className="px-3 pb-3 flex items-center justify-between border-t bg-muted/20">
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
                  Today
                </Button>
              </div>
            </div>
          </div>

          {/* Time Slot Picker */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Available Times</Label>
            <div className="rounded-lg border p-3">
              <TimeSlotPicker
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onTimeSelect={onTimeChange}
              />
            </div>
          </div>
        </div>
        
        {/* Full-width Planned Sessions */}
        {sessionsForDay.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary/60"></span>
                Planned sessions on {selectedDate ? formatLongDate(selectedDate, browserLocale) : 'this day'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sortedSessionsForDay.map((s: any) => (
                  <div 
                    key={s.id} 
                    className="flex items-center gap-3 p-2 bg-muted/30 rounded border text-sm animate-fade-in"
                    style={{ 
                      animationDelay: `${sortedSessionsForDay.indexOf(s) * 50}ms`,
                      animationFillMode: 'both'
                    }}
                  >
                    <div className="text-xs text-muted-foreground min-w-[3.5rem]">
                      {s.session_time ? new Intl.DateTimeFormat(browserLocale, {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: undefined
                      }).format(new Date(`2000-01-01T${s.session_time}`)) : 'No time'}
                    </div>
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate">
                        {s.leads?.name || 'Unknown client'}
                      </div>
                      {s.projects?.name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {s.projects.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}