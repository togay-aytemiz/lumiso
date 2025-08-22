import { formatDate, formatTime } from "@/lib/utils";

export const getRelativeDate = (dateString: string): string => {
  const sessionDate = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // Reset time to compare just dates
  const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (sessionDateOnly.getTime() === todayOnly.getTime()) {
    return "Today";
  } else if (sessionDateOnly.getTime() === tomorrowOnly.getTime()) {
    return "Tomorrow";
  } else if (sessionDateOnly.getTime() === yesterdayOnly.getTime()) {
    return "Yesterday";
  }

  return formatDate(dateString);
};

export const isOverdueSession = (dateString: string, status: string): boolean => {
  const sessionDate = new Date(dateString);
  const today = new Date();
  
  // Reset time to compare just dates
  const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  return sessionDateOnly < todayOnly && status === 'planned';
};

export const getDateDisplayClasses = (dateString: string): string => {
  const relativeDate = getRelativeDate(dateString);
  
  if (relativeDate === "Today" || relativeDate === "Tomorrow") {
    return "text-primary font-medium";
  }
  
  return "text-foreground";
};