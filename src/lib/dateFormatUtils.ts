import { formatDate as utilsFormatDate } from "@/lib/utils";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

const FALLBACK_TIMEZONE = "Etc/GMT-3"; // GMT+3 (IANA Etc zones use inverted signs)

export interface DateFormatOptions {
  dateFormat?: string;
  locale?: string;
}

export function formatDateWithOrgSettings(
  dateString: string | Date, 
  options: DateFormatOptions = {}
): string {
  const { dateFormat = 'DD/MM/YYYY', locale = 'en-US' } = options;
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  // Handle different date format preferences
  switch (dateFormat) {
    case 'MM/DD/YYYY':
      return date.toLocaleDateString('en-US');
    case 'DD/MM/YYYY':
      return date.toLocaleDateString('en-GB');
    case 'YYYY-MM-DD':
      return date.toISOString().split('T')[0];
    case 'DD-MM-YYYY':
      return date.toLocaleDateString('en-GB').replace(/\//g, '-');
    case 'MM-DD-YYYY':
      return date.toLocaleDateString('en-US').replace(/\//g, '-');
    default:
      return utilsFormatDate(dateString, locale);
  }
}

export function formatTimeWithOrgSettings(
  timeString: string,
  timeFormat: '12-hour' | '24-hour' = '12-hour'
): string {
  if (!timeString) return '';
  
  // If it's already in HH:mm format, convert based on preference
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (timeFormat === '24-hour') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } else {
    // Convert to 12-hour format
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}

// Timezone Detection Utilities
export function detectBrowserTimezone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) {
      return timeZone;
    }
  } catch {
    // Ignore errors and fall through to fallback value
  }
  return FALLBACK_TIMEZONE;
}

export function detectBrowserHourFormat(): '12-hour' | '24-hour' {
  try {
    const formatter = Intl.DateTimeFormat(undefined, { hour: 'numeric' });
    const options = formatter.resolvedOptions();
    if (options.hourCycle) {
      if (options.hourCycle === 'h11' || options.hourCycle === 'h12') {
        return '12-hour';
      }
      if (options.hourCycle === 'h23' || options.hourCycle === 'h24') {
        return '24-hour';
      }
    }
    if (typeof options.hour12 === 'boolean') {
      return options.hour12 ? '12-hour' : '24-hour';
    }
  } catch {
    // Ignore detection failures and fall through to default
  }
  return '24-hour';
}

export function getSupportedTimezones(): Array<{ value: string; label: string; region: string }> {
  // Use a predefined list of common timezones instead of Intl.supportedValuesOf
  // which is not supported in all environments
  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Toronto',
    'America/Montreal',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Buenos_Aires',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/Zurich',
    'Europe/Vienna',
    'Europe/Prague',
    'Europe/Warsaw',
    'Europe/Stockholm',
    'Europe/Helsinki',
    'Europe/Moscow',
    'Europe/Kiev',
    'Europe/Istanbul',
    'Africa/Cairo',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Bangkok',
    'Asia/Jakarta',
    'Asia/Shanghai',
    'Asia/Beijing',
    'Asia/Hong_Kong',
    'Asia/Taipei',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Singapore',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Brisbane',
    'Australia/Perth',
    'Pacific/Auckland',
    'Pacific/Honolulu',
  ];

  return commonTimezones.map(tz => {
    const parts = tz.split('/');
    const region = parts[0] || 'UTC';
    const city = parts[1] || tz;
    return {
      value: tz,
      label: `${city.replace(/_/g, ' ')} (${tz})`,
      region
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

// Timezone-aware date/time formatting
export interface OrgSettings {
  dateFormat?: string;
  timeFormat?: '12-hour' | '24-hour';
  timezone?: string;
}

export function formatDateTimeInTimezone(
  date: string | Date,
  timezone: string = 'UTC',
  options: DateFormatOptions & { timeFormat?: '12-hour' | '24-hour' } = {}
): string {
  const { dateFormat = 'DD/MM/YYYY', timeFormat = '12-hour' } = options;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format date part
    let format = 'yyyy-MM-dd';
    switch (dateFormat) {
      case 'MM/DD/YYYY':
        format = 'MM/dd/yyyy';
        break;
      case 'DD/MM/YYYY':
        format = 'dd/MM/yyyy';
        break;
      case 'DD-MM-YYYY':
        format = 'dd-MM-yyyy';
        break;
      case 'MM-DD-YYYY':
        format = 'MM-dd-yyyy';
        break;
    }
    
    // Add time format
    if (timeFormat === '24-hour') {
      format += ' HH:mm';
    } else {
      format += ' h:mm a';
    }
    
    return formatInTimeZone(dateObj, timezone, format);
  } catch {
    return formatDateWithOrgSettings(date, options);
  }
}

export function convertToOrgTimezone(utcDate: string | Date, timezone: string = 'UTC'): Date {
  try {
    const dateObj = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    return toZonedTime(dateObj, timezone);
  } catch {
    return typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  }
}

export function convertFromOrgTimezone(localDate: Date, timezone: string = 'UTC'): Date {
  try {
    return fromZonedTime(localDate, timezone);
  } catch {
    return localDate;
  }
}

export function formatDateInTimezone(
  date: string | Date,
  timezone: string = 'UTC',
  dateFormat: string = 'DD/MM/YYYY'
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    let format = 'yyyy-MM-dd';
    switch (dateFormat) {
      case 'MM/DD/YYYY':
        format = 'MM/dd/yyyy';
        break;
      case 'DD/MM/YYYY':
        format = 'dd/MM/yyyy';
        break;
      case 'DD-MM-YYYY':
        format = 'dd-MM-yyyy';
        break;
      case 'MM-DD-YYYY':
        format = 'MM-dd-yyyy';
        break;
    }
    
    return formatInTimeZone(dateObj, timezone, format);
  } catch {
    return formatDateWithOrgSettings(date, { dateFormat });
  }
}

export function formatTimeInTimezone(
  date: string | Date,
  timezone: string = 'UTC',
  timeFormat: '12-hour' | '24-hour' = '12-hour'
): string {
  try {
    if (typeof date === 'string') {
      const trimmed = date.trim();
      const timeOnlyPattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
      if (timeOnlyPattern.test(trimmed)) {
        return formatTimeWithOrgSettings(trimmed, timeFormat);
      }
    }
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(dateObj.getTime())) {
      return '';
    }
    const format = timeFormat === '24-hour' ? 'HH:mm' : 'h:mm a';
    return formatInTimeZone(dateObj, timezone, format);
  } catch {
    return '';
  }
}
