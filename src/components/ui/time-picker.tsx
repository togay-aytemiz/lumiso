import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
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

  // Generate hour options (6 AM to 9 PM)
  const hours = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => i + 6);
  }, []);

  // 15-minute intervals
  const minutes = [0, 15, 30, 45];

  // Common preset times
  const presets = [
    { label: "9:00 AM", hour: 9, minute: 0 },
    { label: "10:00 AM", hour: 10, minute: 0 },
    { label: "1:00 PM", hour: 13, minute: 0 },
    { label: "2:00 PM", hour: 14, minute: 0 },
    { label: "3:00 PM", hour: 15, minute: 0 },
    { label: "5:00 PM", hour: 17, minute: 0 }
  ];

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatDisplayTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const handleTimeChange = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    onChange(formatTime(hour, minute));
  };

  const handlePresetClick = (preset: typeof presets[0]) => {
    handleTimeChange(preset.hour, preset.minute);
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

      {/* Quick Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick Select</Label>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <Button
              key={`${preset.hour}-${preset.minute}`}
              variant={selectedHour === preset.hour && selectedMinute === preset.minute ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Hour Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Hour</Label>
        <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
          {hours.map((hour) => (
            <Button
              key={hour}
              variant={selectedHour === hour ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 tabular-nums"
              onClick={() => handleTimeChange(hour, selectedMinute)}
              disabled={disabled}
            >
              {hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}
              <span className="text-[10px] ml-0.5 opacity-60">
                {hour >= 12 ? 'PM' : 'AM'}
              </span>
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

      {/* Fine Adjustment */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Fine Tune</Label>
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const newHour = selectedHour > 6 ? selectedHour - 1 : selectedHour;
                handleTimeChange(newHour, selectedMinute);
              }}
              disabled={disabled || selectedHour <= 6}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground w-8 text-center">Hr</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const newHour = selectedHour < 21 ? selectedHour + 1 : selectedHour;
                handleTimeChange(newHour, selectedMinute);
              }}
              disabled={disabled || selectedHour >= 21}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const currentIndex = minutes.indexOf(selectedMinute);
                const newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
                handleTimeChange(selectedHour, minutes[newIndex]);
              }}
              disabled={disabled || selectedMinute === 0}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground w-8 text-center">Min</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const currentIndex = minutes.indexOf(selectedMinute);
                const newIndex = currentIndex < minutes.length - 1 ? currentIndex + 1 : currentIndex;
                handleTimeChange(selectedHour, minutes[newIndex]);
              }}
              disabled={disabled || selectedMinute === 45}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}