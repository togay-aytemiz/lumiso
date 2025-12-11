import { useEffect, useMemo, useState, useId } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, getUserLocale, getDateFnsLocale } from "@/lib/utils";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";

interface DateTimePickerProps {
  value?: string; // ISO local string: YYYY-MM-DDTHH:mm (datetime) or YYYY-MM-DD (date-only)
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  timeLabel?: string;
  todayLabel?: string;
  clearLabel?: string;
  doneLabel?: string;
  mode?: "datetime" | "date";
  popoverModal?: boolean;
  defaultTime?: string; // HH:mm used when no time is provided
  fullWidth?: boolean;
}

type CalendarValue = Date | Date[] | null;

function toIsoLocal(date: Date, hours: number, minutes: number, mode: "datetime" | "date") {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (mode === "date") {
    return datePart;
  }
  return `${datePart}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseIsoLocal(
  value?: string,
  mode: "datetime" | "date" = "datetime",
  defaultTime: string = "09:00"
) {
  const [fallbackHoursRaw, fallbackMinutesRaw] = defaultTime.split(":").map(Number);
  const fallbackHours = Number.isFinite(fallbackHoursRaw) ? fallbackHoursRaw : 9;
  const fallbackMinutes = Number.isFinite(fallbackMinutesRaw) ? fallbackMinutesRaw : 0;

  if (!value) {
    return {
      date: undefined as Date | undefined,
      hours: fallbackHours,
      minutes: fallbackMinutes,
    };
  }
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart || defaultTime).split(":").map(Number);
  const safeHours =
    mode === "datetime" && Number.isFinite(hh) ? hh : fallbackHours;
  const safeMinutes =
    mode === "datetime" && Number.isFinite(mm) ? mm : fallbackMinutes;
  return {
    date: Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
      ? new Date(y, (m || 1) - 1, d || 1)
      : undefined,
    hours: safeHours,
    minutes: safeMinutes,
  };
}

const displayFormat = (date?: Date, h?: number, m?: number, mode: "datetime" | "date" = "datetime") => {
  if (!date) return undefined;
  const withTime = new Date(date);
  if (mode === "datetime") {
    withTime.setHours(h ?? 0, m ?? 0, 0, 0);
    return format(withTime, "PP p", { locale: getDateFnsLocale() });
  }
  return format(withTime, "PPP", { locale: getDateFnsLocale() });
};

export function DateTimePicker({
  value,
  onChange,
  className,
  buttonClassName,
  placeholder = "Pick date & time",
  timeLabel = "Time",
  todayLabel = "Today",
  clearLabel = "Clear",
  doneLabel = "Done",
  mode = "datetime",
  popoverModal = false,
  defaultTime = "09:00",
  fullWidth = false,
}: DateTimePickerProps) {
  const { date: initialDate, hours: initialHours, minutes: initialMinutes } = useMemo(
    () => parseIsoLocal(value, mode, defaultTime),
    [value, mode, defaultTime]
  );

  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  const [hours, setHours] = useState<number>(initialHours);
  const [minutes, setMinutes] = useState<number>(initialMinutes);
  const pickerId = useId();
  const hourSelectId = `${pickerId}-hour`;
  const minuteSelectId = `${pickerId}-minute`;

  useEffect(() => {
    const parsed = parseIsoLocal(value, mode, defaultTime);
    setSelectedDate(parsed.date);
    setHours(parsed.hours);
    setMinutes(parsed.minutes);
  }, [value, mode, defaultTime]);

  const browserLocale = getUserLocale();
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 5, 10, 15, 20, 30, 45];
  const timeSelectClassName = cn(
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen} modal={popoverModal}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className={cn(
              "justify-start text-left font-normal",
              fullWidth ? "w-full" : "w-full md:w-[260px]",
              !value && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayFormat(selectedDate, hours, minutes, mode) || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 rounded-xl border border-border shadow-md"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="p-2">
            <ReactCalendar
              className="react-calendar w-full p-2 pointer-events-auto"
              locale={browserLocale}
              view="month"
              minDetail="month"
              next2Label={null}
              prev2Label={null}
              onChange={(nextValue: CalendarValue) => {
                const nextDate = Array.isArray(nextValue) ? nextValue[0] : nextValue;
                if (nextDate instanceof Date) {
                  setSelectedDate(nextDate);
                  // Automatically emit the change when date is selected
                  onChange(toIsoLocal(nextDate, hours, minutes, mode));
                }
              }}
              value={selectedDate || null}
              formatShortWeekday={(_, date) => new Intl.DateTimeFormat(browserLocale, { weekday: 'short' }).format(date)}
            />
            <div className="px-1 pt-2 space-y-3">
              {mode === "datetime" && (
                <>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {timeLabel}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={hourSelectId} className="sr-only">
                        Hour
                      </Label>
                      <select
                        id={hourSelectId}
                        className={timeSelectClassName}
                        value={String(hours)}
                        onChange={(event) => {
                          const newHours = parseInt(event.target.value, 10);
                          setHours(newHours);
                          if (selectedDate) {
                            onChange(toIsoLocal(selectedDate, newHours, minutes, mode));
                          }
                        }}
                      >
                        {hourOptions.map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={minuteSelectId} className="sr-only">
                        Minutes
                      </Label>
                      <select
                        id={minuteSelectId}
                        className={timeSelectClassName}
                        value={String(minutes)}
                        onChange={(event) => {
                          const newMinutes = parseInt(event.target.value, 10);
                          setMinutes(newMinutes);
                          if (selectedDate) {
                            onChange(toIsoLocal(selectedDate, hours, newMinutes, mode));
                          }
                        }}
                      >
                        {minuteOptions.map((m) => (
                          <option key={m} value={m}>
                            {String(m).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setSelectedDate(today);
                      // Also emit the change when "Today" is clicked
                      onChange(toIsoLocal(today, hours, minutes, mode));
                    }}
                  >
                    {todayLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      setSelectedDate(undefined);
                      setHours(9);
                      setMinutes(0);
                      onChange("");
                    }}
                  >
                    {clearLabel}
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  {doneLabel}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateTimePicker;
