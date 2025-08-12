import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value?: string;
  onChange: (time: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
}

export function TimePicker({ value, onChange, placeholder = "Select time", id, required }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(
    value ? parseInt(value.split(':')[0]) : null
  );
  const [selectedMinute, setSelectedMinute] = useState<number | null>(
    value ? parseInt(value.split(':')[1]) : null
  );

  // Generate hours (0-23) and minutes (0, 15, 30, 45)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const handleTimeSelect = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onChange(timeString);
    setOpen(false);
  };

  const formatDisplayTime = () => {
    if (selectedHour !== null && selectedMinute !== null) {
      const hour12 = selectedHour === 0 ? 12 : selectedHour > 12 ? selectedHour - 12 : selectedHour;
      const ampm = selectedHour >= 12 ? 'PM' : 'AM';
      return `${hour12}:${selectedMinute.toString().padStart(2, '0')} ${ampm}`;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            {formatDisplayTime() || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4 rounded-xl border border-border shadow-md" align="start">
          <div className="space-y-4">
            <div className="text-sm font-medium text-foreground">Select Time</div>
            
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {hours.map(hour => (
                <div key={hour} className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground text-center">
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </div>
                  {minutes.map(minute => (
                    <Button
                      key={`${hour}-${minute}`}
                      variant={selectedHour === hour && selectedMinute === minute ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 text-xs p-1 transition-colors rounded-md",
                        selectedHour === hour && selectedMinute === minute 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-primary/10 hover:text-primary"
                      )}
                      onClick={() => handleTimeSelect(hour, minute)}
                    >
                      :{minute.toString().padStart(2, '0')}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}