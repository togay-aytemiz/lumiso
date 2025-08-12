import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: string; // ISO local string: YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
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

const displayFormat = (date?: Date, h?: number, m?: number) => {
  if (!date) return undefined;
  const withTime = new Date(date);
  withTime.setHours(h ?? 0, m ?? 0, 0, 0);
  return format(withTime, "PP p");
};

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  className,
  buttonClassName,
  placeholder = "Pick date & time",
}) => {
  const { date: initialDate, hours: initialHours, minutes: initialMinutes } = useMemo(
    () => parseIsoLocal(value),
    [value]
  );

  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  const [hours, setHours] = useState<number>(initialHours);
  const [minutes, setMinutes] = useState<number>(initialMinutes);

  useEffect(() => {
    const parsed = parseIsoLocal(value);
    setSelectedDate(parsed.date);
    setHours(parsed.hours);
    setMinutes(parsed.minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 5, 10, 15, 20, 30, 45];

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className={cn(
              "justify-start text-left font-normal w-full md:w-[260px]",
              !value && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayFormat(selectedDate, hours, minutes) || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-xl border border-border shadow-md" align="start">
          <div className="p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              className={cn("p-3 pointer-events-auto rounded-lg border border-border bg-background")}
            />
            <div className="px-1 pt-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Time
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select value={String(hours)} onValueChange={(v) => setHours(parseInt(v))}>
                  <SelectTrigger className="h-9 rounded-md">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent align="start" className="max-h-64">
                    {hourOptions.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(minutes)} onValueChange={(v) => setMinutes(parseInt(v))}>
                  <SelectTrigger className="h-9 rounded-md">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent align="start" className="max-h-64">
                    {minuteOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {String(m).padStart(2, "0")}
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
                      setOpen(false);
                    }
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateTimePicker;
