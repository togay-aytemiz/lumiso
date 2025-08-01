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

export const formatTime = (timeString: string, locale?: string): string => {
  const userLocale = locale || getUserLocale();
  
  // Parse time string (HH:mm format)
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  
  // Determine if locale uses 24-hour format
  const uses24Hour = userLocale.startsWith('tr') || 
                     userLocale.startsWith('de') || 
                     userLocale.startsWith('fr') || 
                     userLocale.startsWith('es') ||
                     userLocale.startsWith('it');
  
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
