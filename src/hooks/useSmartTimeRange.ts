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

const SLOT_INTERVAL_MINUTES = 30;
const MIN_SPAN_MINUTES = 8 * 60;
const DEFAULT_BUSINESS_START = 7 * 60;
const DEFAULT_BUSINESS_END = 20 * 60;
const BUFFER_BEFORE_MINUTES = 60;
const BUFFER_AFTER_MINUTES = 90;
const MAX_MINUTE_OF_DAY = 23 * 60 + 30;

const roundDownToSlot = (minutes: number) => {
  const rounded = Math.floor(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
  return Math.max(0, Math.min(rounded, MAX_MINUTE_OF_DAY));
};

const roundUpToSlot = (minutes: number) => {
  const rounded = Math.ceil(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
  return Math.max(0, Math.min(rounded, MAX_MINUTE_OF_DAY));
};

const ensureMinSpan = (start: number, end: number) => {
  let adjustedStart = start;
  let adjustedEnd = end;

  if (adjustedEnd - adjustedStart >= MIN_SPAN_MINUTES) {
    return { start: adjustedStart, end: adjustedEnd };
  }

  const missingMinutes = MIN_SPAN_MINUTES - (adjustedEnd - adjustedStart);
  const slotsToAdd = Math.ceil(missingMinutes / SLOT_INTERVAL_MINUTES);
  const expandBefore = Math.floor(slotsToAdd / 2) * SLOT_INTERVAL_MINUTES;
  const expandAfter = (slotsToAdd - Math.floor(slotsToAdd / 2)) * SLOT_INTERVAL_MINUTES;

  adjustedStart = Math.max(0, adjustedStart - expandBefore);
  adjustedEnd = Math.min(MAX_MINUTE_OF_DAY, adjustedEnd + expandAfter);

  if (adjustedEnd - adjustedStart < MIN_SPAN_MINUTES) {
    if (adjustedStart === 0) {
      adjustedEnd = Math.min(MAX_MINUTE_OF_DAY, adjustedStart + MIN_SPAN_MINUTES);
    } else if (adjustedEnd === MAX_MINUTE_OF_DAY) {
      adjustedStart = Math.max(0, adjustedEnd - MIN_SPAN_MINUTES);
    } else {
      adjustedEnd = Math.min(MAX_MINUTE_OF_DAY, adjustedStart + MIN_SPAN_MINUTES);
    }
  }

  return {
    start: adjustedStart,
    end: adjustedEnd
  };
};

const parseTimeToMinutes = (timeString?: string | null) => {
  if (!timeString) return null;
  const [hourPart, minutePart] = timeString.split(':').map(part => Number.parseInt(part, 10));
  if (Number.isNaN(hourPart) || Number.isNaN(minutePart)) return null;
  return hourPart * 60 + minutePart;
};

/**
 * Hook for generating smart time ranges based on actual events
 * Creates 30-minute intervals that keep low-activity weeks centered around the current time.
 */
export function useSmartTimeRange(sessions: Session[], activities: Activity[]) {
  const { timeFormat, getCurrentTime } = useOrganizationTimezone();
  const currentOrgTime = getCurrentTime();
  const currentMinutes = currentOrgTime.getHours() * 60 + currentOrgTime.getMinutes();

  const timeSlots = useMemo(() => {
    let earliestEventMinutes = Number.POSITIVE_INFINITY;
    let latestEventMinutes = Number.NEGATIVE_INFINITY;

    sessions.forEach(session => {
      const eventMinutes = parseTimeToMinutes(session.session_time);
      if (eventMinutes == null) return;
      if (eventMinutes < earliestEventMinutes) earliestEventMinutes = eventMinutes;
      if (eventMinutes > latestEventMinutes) latestEventMinutes = eventMinutes;
    });

    activities.forEach(activity => {
      const eventMinutes = parseTimeToMinutes(activity.reminder_time);
      if (eventMinutes == null) return;
      if (eventMinutes < earliestEventMinutes) earliestEventMinutes = eventMinutes;
      if (eventMinutes > latestEventMinutes) latestEventMinutes = eventMinutes;
    });

    const hasTimedEvents = Number.isFinite(earliestEventMinutes) && Number.isFinite(latestEventMinutes);

    const clampStart = (minutes: number) => {
      const maxStart = Math.max(0, MAX_MINUTE_OF_DAY - MIN_SPAN_MINUTES);
      return Math.max(0, Math.min(minutes, maxStart));
    };

    const computeTargetRange = () => {
      let suggestedStart = clampStart(currentMinutes - MIN_SPAN_MINUTES / 2);
      let suggestedEnd = suggestedStart + MIN_SPAN_MINUTES;

      if (!hasTimedEvents && currentMinutes >= DEFAULT_BUSINESS_START && currentMinutes <= DEFAULT_BUSINESS_END) {
        if (suggestedStart < DEFAULT_BUSINESS_START) {
          const offset = DEFAULT_BUSINESS_START - suggestedStart;
          suggestedStart = DEFAULT_BUSINESS_START;
          suggestedEnd = Math.min(MAX_MINUTE_OF_DAY, suggestedEnd + offset);
        }

        if (suggestedEnd > DEFAULT_BUSINESS_END) {
          const offset = suggestedEnd - DEFAULT_BUSINESS_END;
          suggestedEnd = DEFAULT_BUSINESS_END;
          suggestedStart = Math.max(0, suggestedStart - offset);
        }
      }

      const normalizedStart = roundDownToSlot(suggestedStart);
      const normalizedEnd = roundUpToSlot(suggestedEnd);
      const ensured = ensureMinSpan(normalizedStart, normalizedEnd);

      return ensured;
    };

    const targetRange = computeTargetRange();
    let finalStart = targetRange.start;
    let finalEnd = targetRange.end;

    if (hasTimedEvents) {
      const eventStart = roundDownToSlot(Math.max(0, earliestEventMinutes - BUFFER_BEFORE_MINUTES));
      const eventEnd = roundUpToSlot(Math.min(MAX_MINUTE_OF_DAY, latestEventMinutes + BUFFER_AFTER_MINUTES));

      finalStart = Math.min(finalStart, eventStart);
      finalEnd = Math.max(finalEnd, eventEnd);

      const ensured = ensureMinSpan(finalStart, finalEnd);
      finalStart = ensured.start;
      finalEnd = ensured.end;
    }

    const formatTimeLabel = (hour: number, minute: number) => {
      if (timeFormat === '12-hour') {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
      }
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    };

    const slots: TimeSlot[] = [];
    for (let minutes = finalStart; minutes <= finalEnd; minutes += SLOT_INTERVAL_MINUTES) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      slots.push({
        time: timeString,
        display: formatTimeLabel(hour, minute),
        hour,
        minute
      });
    }

    return slots;
  }, [activities, currentMinutes, sessions, timeFormat]);

  const getSlotIndex = useMemo(() => {
    return (timeString: string) => {
      if (!timeString) return 0;

      const [hourStr, minuteStr] = timeString.split(':');
      const hour = Number.parseInt(hourStr, 10);
      const minute = Number.parseInt(minuteStr, 10);

      if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;

      const roundedMinute = minute < 15 ? 0 : 30;

      const slotIndex = timeSlots.findIndex(slot => slot.hour === hour && slot.minute === roundedMinute);
      return slotIndex === -1 ? 0 : slotIndex;
    };
  }, [timeSlots]);

  const timeRangeStats = useMemo(() => {
    const startTime = timeSlots[0]?.time || '00:00';
    const endTime = timeSlots[timeSlots.length - 1]?.time || '23:30';
    const totalSlots = timeSlots.length;
    const totalHours = totalSlots > 0 ? (timeSlots.length - 1) / 2 : 0;

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
