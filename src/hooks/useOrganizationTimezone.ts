import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { 
  formatDateTimeInTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
  convertToOrgTimezone,
  convertFromOrgTimezone,
  detectBrowserTimezone
} from "@/lib/dateFormatUtils";

/**
 * Hook for timezone-aware date/time operations within the organization context
 */
export function useOrganizationTimezone() {
  const { settings } = useOrganizationSettings();
  
  const timezone = settings?.timezone || detectBrowserTimezone();
  const dateFormat = settings?.date_format || 'DD/MM/YYYY';
  const timeFormat = settings?.time_format || '12-hour';

  // Format date/time in organization timezone
  const formatDateTime = (date: string | Date): string => {
    return formatDateTimeInTimezone(date, timezone, { 
      dateFormat, 
      timeFormat: timeFormat as '12-hour' | '24-hour' 
    });
  };

  // Format date only in organization timezone
  const formatDate = (date: string | Date): string => {
    return formatDateInTimezone(date, timezone, dateFormat);
  };

  // Format time only in organization timezone  
  const formatTime = (date: string | Date): string => {
    return formatTimeInTimezone(date, timezone, timeFormat as '12-hour' | '24-hour');
  };

  // Convert UTC/server time to organization timezone
  const toOrgTimezone = (utcDate: string | Date): Date => {
    return convertToOrgTimezone(utcDate, timezone);
  };

  // Convert organization timezone to UTC for server storage
  const fromOrgTimezone = (localDate: Date): Date => {
    return convertFromOrgTimezone(localDate, timezone);
  };

  // Get current time in organization timezone
  const getCurrentTime = (): Date => {
    return toOrgTimezone(new Date());
  };

  // Format current time for display
  const getCurrentTimeString = (): string => {
    return formatTime(new Date());
  };

  return {
    timezone,
    dateFormat,
    timeFormat,
    formatDateTime,
    formatDate,
    formatTime,
    toOrgTimezone,
    fromOrgTimezone,
    getCurrentTime,
    getCurrentTimeString,
    settings
  };
}