import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";
import { getUserLocale } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface DateTimePickerProps {
  value?: string; // ISO local string: YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  className?: string;
}

function toIsoLocal(date: Date, hours: number, minutes: number) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseIsoLocal(value?: string) {
  if (!value) return { date: undefined as Date | undefined, hours: 9, minutes: 0 };
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart || "09:00").split(":").map(Number);
  return { date: new Date(y, (m || 1) - 1, d || 1), hours: hh || 9, minutes: mm || 0 };
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange, className }) => {
  const browserLocale = getUserLocale();
  const { date: initialDate, hours: initialHours, minutes: initialMinutes } = useMemo(() => parseIsoLocal(value), [value]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  const [hours, setHours] = useState<number>(initialHours);
  const [minutes, setMinutes] = useState<number>(initialMinutes);

  useEffect(() => {
    // keep external value in sync if it changes from outside
    const parsed = parseIsoLocal(value);
    setSelectedDate(parsed.date);
    setHours(parsed.hours);
    setMinutes(parsed.minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (selectedDate) {
      onChange(toIsoLocal(selectedDate, hours, minutes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, hours, minutes]);

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45];

  return (
    <div className={className}>
      <div className="rounded-xl border border-border bg-background shadow-sm p-2">
        <ReactCalendar
          className="react-calendar w-full p-2"
          locale={browserLocale}
          next2Label={null}
          prev2Label={null}
          onChange={(value: any) => {
            if (value instanceof Date) {
              setSelectedDate(value);
            }
          }}
          value={selectedDate || null}
          formatShortWeekday={(_, date) => new Intl.DateTimeFormat(browserLocale, { weekday: 'short' }).format(date)}
        />
        <div className="px-2 pb-2">
          <Label className="text-xs text-muted-foreground">Time</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select
              value={String(hours)}
              onValueChange={(v) => setHours(parseInt(v))}
            >
              <SelectTrigger className="rounded-md h-9">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {hourOptions.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {`${String(h).padStart(2, '0')}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(minutes)}
              onValueChange={(v) => setMinutes(parseInt(v))}
            >
              <SelectTrigger className="rounded-md h-9">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {minuteOptions.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {`${String(m).padStart(2, '0')}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between">
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
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedDate}
              onClick={() => {
                if (selectedDate) {
                  onChange(toIsoLocal(selectedDate, hours, minutes));
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateTimePicker;
