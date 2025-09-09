import { formatDate as utilsFormatDate } from "@/lib/utils";

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