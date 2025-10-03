import React, { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn, getUserLocale } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";
import { useTranslation } from "react-i18next";

interface DateRangePickerProps {
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export const DateRangePicker = ({ dateRange, onDateRangeChange, className }: DateRangePickerProps) => {
  const { t } = useTranslation('forms');
  const [isOpen, setIsOpen] = useState(false);

  const browserLocale = getUserLocale();

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) {
      return t('dateRangePicker.placeholder');
    }
    if (!range.to) {
      return format(range.from, "MMM dd, yyyy");
    }
    return `${format(range.from, "MMM dd, yyyy")} - ${format(range.to, "MMM dd, yyyy")}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "justify-start text-left font-normal whitespace-nowrap max-w-xs",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange(dateRange)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border shadow-lg" align="start">
        <ReactCalendar
          className="react-calendar w-full p-2 pointer-events-auto"
          locale={browserLocale}
          selectRange
          next2Label={null}
          prev2Label={null}
          onChange={(value: any) => {
            if (Array.isArray(value)) {
              const [from, to] = value as [Date | null, Date | null];
              const range: DateRange | undefined = from
                ? { from: from as Date, to: (to as Date) || undefined }
                : undefined;
              onDateRangeChange(range);
              if (from && to) setIsOpen(false);
            }
          }}
          value={dateRange?.from ? [dateRange.from, dateRange.to || dateRange.from] : null}
          formatShortWeekday={(_, date) => new Intl.DateTimeFormat(browserLocale, { weekday: 'short' }).format(date)}
        />
      </PopoverContent>
    </Popover>
  );
};