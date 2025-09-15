import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useWorkingHours } from "@/hooks/useWorkingHours";
import { cn } from "@/lib/utils";

interface TimeSlotPickerProps {
  selectedDate?: Date;
  selectedTime?: string;
  onTimeSelect: (time: string) => void;
  className?: string;
}

const generateTimeSlots = (startTime: string, endTime: string): string[] => {
  const slots: string[] = [];
  
  // Parse start and end times
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // Create start and end date objects for easier calculation
  const start = new Date();
  start.setHours(startHour, startMinute, 0, 0);
  
  const end = new Date();
  end.setHours(endHour, endMinute, 0, 0);
  
  // Generate 30-minute slots
  const current = new Date(start);
  while (current < end) {
    const hours = current.getHours();
    const minutes = current.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    slots.push(timeString);
    
    // Add 30 minutes
    current.setMinutes(current.getMinutes() + 30);
  }
  
  return slots;
};

const formatTimeSlot = (time: string, locale?: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  
  // Use Intl.DateTimeFormat to respect user's locale preferences
  return new Intl.DateTimeFormat(locale || navigator.language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: undefined // Let the locale decide 12/24 hour format
  }).format(date);
};

export function TimeSlotPicker({ selectedDate, selectedTime, onTimeSelect, className }: TimeSlotPickerProps) {
  const { workingHours, loading } = useWorkingHours();
  const userLocale = navigator.language;
  
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading available times...</span>
        </div>
      </div>
    );
  }

  if (!selectedDate) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a date to view available times</p>
        </div>
      </div>
    );
  }

  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = selectedDate.getDay();
  
  // Find working hours for this day
  const dayWorkingHours = workingHours.find(wh => wh.day_of_week === dayOfWeek);
  
  if (!dayWorkingHours || !dayWorkingHours.enabled || !dayWorkingHours.start_time || !dayWorkingHours.end_time) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No working hours set for this day</p>
          <p className="text-xs mt-1">Configure working hours in settings to see available times</p>
        </div>
      </div>
    );
  }

  const timeSlots = generateTimeSlots(dayWorkingHours.start_time, dayWorkingHours.end_time);
  
  if (timeSlots.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No available time slots</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Available Times</Label>
        <Badge variant="secondary" className="text-xs">
          {timeSlots.length} slots
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {timeSlots.map((slot) => (
          <Button
            key={slot}
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-xs h-8 transition-colors",
              selectedTime?.trim().startsWith(slot.trim())
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
            aria-pressed={selectedTime?.trim().startsWith(slot.trim())}
            onClick={() => onTimeSelect(slot)}
          >
            {formatTimeSlot(slot, userLocale)}
          </Button>
        ))}
      </div>
    </div>
  );
}