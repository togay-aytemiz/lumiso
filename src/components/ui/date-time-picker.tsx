import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Calendar from "react-calendar";
import "../react-calendar.css";

interface DateTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({ value, onChange, placeholder = "Select date and time", className }: DateTimePickerProps) {
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string>("");
  const [open, setOpen] = useState(false);

  // Parse the initial value
  useEffect(() => {
    if (value) {
      const dateObj = new Date(value);
      if (!isNaN(dateObj.getTime())) {
        setDate(dateObj);
        setTime(format(dateObj, "HH:mm"));
      }
    } else {
      setDate(null);
      setTime("");
    }
  }, [value]);

  const handleDateSelect = (selectedDate: Date | null) => {
    if (selectedDate) {
      setDate(selectedDate);
      updateDateTime(selectedDate, time);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date) {
      updateDateTime(date, newTime);
    }
  };

  const updateDateTime = (selectedDate: Date, selectedTime: string) => {
    if (selectedDate && selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const combined = new Date(selectedDate);
      combined.setHours(hours, minutes, 0, 0);
      
      // Format as datetime-local string
      const year = combined.getFullYear();
      const month = String(combined.getMonth() + 1).padStart(2, '0');
      const day = String(combined.getDate()).padStart(2, '0');
      const hour = String(combined.getHours()).padStart(2, '0');
      const minute = String(combined.getMinutes()).padStart(2, '0');
      const datetimeLocal = `${year}-${month}-${day}T${hour}:${minute}`;
      
      onChange(datetimeLocal);
    }
  };

  const formatDisplayText = () => {
    if (date && time) {
      const [hours, minutes] = time.split(':').map(Number);
      const combined = new Date(date);
      combined.setHours(hours, minutes, 0, 0);
      return format(combined, "MMM dd, yyyy 'at' HH:mm");
    }
    return placeholder;
  };

  const browserLocale = navigator.language || 'en-US';

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <div className="p-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Date</Label>
              <Calendar
                value={date}
                onChange={handleDateSelect}
                className="react-calendar"
                locale={browserLocale}
                next2Label={null}
                prev2Label={null}
                minDate={new Date()}
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="flex-1"
                  placeholder="Select time"
                />
              </div>
            </div>
            
            {date && time && (
              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  Selected: {formatDisplayText()}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}