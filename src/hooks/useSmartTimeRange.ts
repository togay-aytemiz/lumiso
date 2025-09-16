import { useMemo } from 'react';
import { useOrganizationTimezone } from './useOrganizationTimezone';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  notes?: string;
  lead_id: string;
  project_id?: string | null;
}

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time?: string;
  type: string;
  lead_id: string;
  project_id?: string | null;
  completed?: boolean;
}

interface TimeSlot {
  time: string;
  display: string;
  hour: number;
  minute: number;
}

/**
 * Hook for generating smart time ranges based on actual events
 * Creates 30-minute intervals with proper organization timezone formatting
 */
export function useSmartTimeRange(sessions: Session[], activities: Activity[]) {
  const { timeFormat, formatTime } = useOrganizationTimezone();
  
  const timeSlots = useMemo(() => {
    // Find earliest and latest event times
    let earliestHour = 7; // Default 7 AM
    let latestHour = 20;   // Default 8 PM
    
    // Check sessions for time range
    sessions.forEach(session => {
      if (session.session_time) {
        const hour = parseInt(session.session_time.split(':')[0]);
        if (hour < earliestHour) earliestHour = hour;
        if (hour > latestHour) latestHour = hour;
      }
    });
    
    // Check activities for time range
    activities.forEach(activity => {
      if (activity.reminder_time) {
        const hour = parseInt(activity.reminder_time.split(':')[0]);
        if (hour < earliestHour) earliestHour = hour;
        if (hour > latestHour) latestHour = hour;
      }
    });
    
    // Extend range by 1 hour on each side for better UX
    earliestHour = Math.max(0, earliestHour - 1);
    latestHour = Math.min(23, latestHour + 2);
    
    // Ensure minimum 8-hour range (business hours)
    if (latestHour - earliestHour < 8) {
      const midPoint = Math.floor((earliestHour + latestHour) / 2);
      earliestHour = Math.max(0, midPoint - 4);
      latestHour = Math.min(23, midPoint + 4);
    }
    
    // Create time formatter function that works with hour/minute numbers
    const formatTimeLabel = (hour: number, minute: number) => {
      if (timeFormat === '12-hour') {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
      } else {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    };
    
    // Generate 30-minute time slots
    const slots: TimeSlot[] = [];
    
    for (let hour = earliestHour; hour <= latestHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = formatTimeLabel(hour, minute); // Show labels for both hour and half-hour marks
        
        slots.push({
          time: timeString,
          display: displayTime, // Show time labels for all slots
          hour,
          minute
        });
      }
    }
    
    return slots;
  }, [sessions, activities, timeFormat]);
  
  // Function to get the slot index for a given time
  const getSlotIndex = useMemo(() => {
    return (timeString: string) => {
      if (!timeString) return 0;
      
      const [hourStr, minuteStr] = timeString.split(':');
      const hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);
      
      // Round to nearest 30-minute interval
      const roundedMinute = minute < 15 ? 0 : 30;
      
      return timeSlots.findIndex(slot => 
        slot.hour === hour && slot.minute === roundedMinute
      );
    };
  }, [timeSlots]);
  
  // Statistics about the time range
  const timeRangeStats = useMemo(() => {
    const startTime = timeSlots[0]?.time || '00:00';
    const endTime = timeSlots[timeSlots.length - 1]?.time || '23:30';
    const totalSlots = timeSlots.length;
    const totalHours = totalSlots / 2; // 2 slots per hour
    
    return {
      startTime,
      endTime,
      totalSlots,
      totalHours,
      slotsPerHour: 2
    };
  }, [timeSlots]);
  
  return {
    timeSlots,
    getSlotIndex,
    timeRangeStats,
    timeFormat
  };
}