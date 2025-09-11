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

const formatTimeSlot = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function TimeSlotPicker({ selectedDate, selectedTime, onTimeSelect, className }: TimeSlotPickerProps) {
  const { workingHours, loading } = useWorkingHours();
  
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
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
        {timeSlots.map((slot) => (
          <Button
            key={slot}
            variant={selectedTime === slot ? "default" : "outline"}
            size="sm"
            className="justify-start text-xs h-8 font-mono"
            onClick={() => onTimeSelect(slot)}
          >
            {formatTimeSlot(slot)}
          </Button>
        ))}
      </div>
      
      {selectedTime && (
        <div className="flex items-center gap-2 p-2 bg-muted/20 rounded border">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-medium">
            Selected: {formatTimeSlot(selectedTime)}
          </span>
        </div>
      )}
    </div>
  );
}