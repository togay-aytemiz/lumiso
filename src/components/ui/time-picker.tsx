import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string;
  onChange: (time: string) => void;
  className?: string;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
  const [selectedHour, setSelectedHour] = useState<number>(() => {
    if (value) {
      const [hour] = value.split(':');
      return parseInt(hour, 10);
    }
    return 9; // Default to 9 AM
  });

  const [selectedMinute, setSelectedMinute] = useState<number>(() => {
    if (value) {
      const [, minute] = value.split(':');
      return parseInt(minute, 10);
    }
    return 0; // Default to :00
  });

  // Detect if user prefers 12-hour format based on locale
  const use12HourFormat = useMemo(() => {
    const locale = navigator.language || 'en-US';
    const testDate = new Date(2023, 0, 1, 13, 0); // 1:00 PM
    const timeString = testDate.toLocaleTimeString(locale, { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    return timeString.includes('PM') || timeString.includes('AM');
  }, []);

  // Generate hour options based on format preference
  const hours = useMemo(() => {
    if (use12HourFormat) {
      return Array.from({ length: 24 }, (_, i) => i);
    } else {
      return Array.from({ length: 24 }, (_, i) => i);
    }
  }, [use12HourFormat]);

  // 15-minute intervals
  const minutes = [0, 15, 30, 45];

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatDisplayTime = (hour: number, minute: number) => {
    if (use12HourFormat) {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const displayMinute = minute.toString().padStart(2, '0');
      return `${displayHour}:${displayMinute} ${period}`;
    } else {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  };

  const formatHourDisplay = (hour: number) => {
    if (use12HourFormat) {
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      return `${displayHour}${period}`;
    } else {
      return hour.toString().padStart(2, '0');
    }
  };

  const handleTimeChange = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    onChange(formatTime(hour, minute));
  };


  return (
    <div className={cn("space-y-4", className)}>
      {/* Selected Time Display */}
      <div className="flex items-center justify-center p-4 rounded-lg border bg-muted/20">
        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
        <span className="text-lg font-semibold tabular-nums">
          {formatDisplayTime(selectedHour, selectedMinute)}
        </span>
      </div>

      {/* Hour Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Hour</Label>
        <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
          {hours.map((hour) => (
            <Button
              key={hour}
              variant={selectedHour === hour ? "default" : "outline"}
              size="sm"
              className="text-xs h-9 tabular-nums"
              onClick={() => handleTimeChange(hour, selectedMinute)}
              disabled={disabled}
            >
              {formatHourDisplay(hour)}
            </Button>
          ))}
        </div>
      </div>

      {/* Minute Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Minutes</Label>
        <div className="grid grid-cols-4 gap-2">
          {minutes.map((minute) => (
            <Button
              key={minute}
              variant={selectedMinute === minute ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 tabular-nums"
              onClick={() => handleTimeChange(selectedHour, minute)}
              disabled={disabled}
            >
              :{minute.toString().padStart(2, '0')}
            </Button>
          ))}
        </div>
      </div>

    </div>
  );
}