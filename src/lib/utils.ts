import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Locale utilities for consistent date/time formatting
export const getUserLocale = (): string => {
  return navigator.language || "en-US";
};

export const formatDate = (dateString: string | Date, locale?: string): string => {
  const userLocale = locale || getUserLocale();
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat(userLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

export const formatTime = (timeString: string, locale?: string, timeFormat?: string): string => {
  const userLocale = locale || getUserLocale();
  
  // Parse time string (HH:mm format)
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  
  // Use provided time format, or determine from locale if not provided
  let uses24Hour: boolean;
  if (timeFormat) {
    uses24Hour = timeFormat === '24-hour';
  } else {
    uses24Hour = userLocale.startsWith('tr') || 
                 userLocale.startsWith('de') || 
                 userLocale.startsWith('fr') || 
                 userLocale.startsWith('es') ||
                 userLocale.startsWith('it');
  }
  
  return new Intl.DateTimeFormat(userLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !uses24Hour
  }).format(date);
};

export const formatDateTime = (dateString: string | Date, timeString?: string, locale?: string): string => {
  const userLocale = locale || getUserLocale();
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  }
  
  const uses24Hour = userLocale.startsWith('tr') || 
                     userLocale.startsWith('de') || 
                     userLocale.startsWith('fr') || 
                     userLocale.startsWith('es') ||
                     userLocale.startsWith('it');
  
  return new Intl.DateTimeFormat(userLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: timeString ? '2-digit' : undefined,
    minute: timeString ? '2-digit' : undefined,
    hour12: timeString ? !uses24Hour : undefined
  }).format(date);
};

export const formatLongDate = (dateString: string | Date, locale?: string): string => {
  const userLocale = locale || getUserLocale();
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat(userLocale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

export const formatGroupDate = (dateString: string | Date, locale?: string): string => {
  const userLocale = locale || getUserLocale();
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat(userLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

// Locale-aware week utilities
export const getStartOfWeek = (date: Date, locale?: string): Date => {
  const userLocale = locale || getUserLocale();
  const startOfWeek = new Date(date);
  
  // For Turkish and most European locales, week starts on Monday (1)
  // For US and some other locales, week starts on Sunday (0)
  const weekStartsOnMonday = userLocale.startsWith('tr') || 
                            userLocale.startsWith('de') || 
                            userLocale.startsWith('fr') || 
                            userLocale.startsWith('es') ||
                            userLocale.startsWith('it') ||
                            userLocale.startsWith('nl') ||
                            userLocale.startsWith('pl');
  
  const currentDay = startOfWeek.getDay();
  
  if (weekStartsOnMonday) {
    // Monday = 1, so we need to subtract (currentDay - 1) to get to Monday
    // But if currentDay is 0 (Sunday), we need to go back 6 days
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract);
  } else {
    // Week starts on Sunday (US style)
    startOfWeek.setDate(startOfWeek.getDate() - currentDay);
  }
  
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
};

export const getEndOfWeek = (date: Date, locale?: string): Date => {
  const startOfWeek = getStartOfWeek(date, locale);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
};

export const getWeekRange = (date: Date, locale?: string): { start: Date; end: Date } => {
  return {
    start: getStartOfWeek(date, locale),
    end: getEndOfWeek(date, locale)
  };
};
