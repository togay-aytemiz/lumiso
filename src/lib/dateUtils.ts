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

export const hasUpcomingPlannedSessions = (sessions: Array<{session_date: string, status: string}>): boolean => {
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  return sessions.some(session => {
    if (session.status !== 'planned') return false;
    
    const sessionDate = new Date(session.session_date);
    const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    
    return sessionDateOnly >= todayOnly;
  });
};

export const getNextPlannedSession = (sessions: Array<{session_date: string, session_time: string, status: string}>): {session_date: string, session_time: string} | null => {
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const upcomingSessions = sessions
    .filter(session => {
      if (session.status !== 'planned') return false;
      
      const sessionDate = new Date(session.session_date);
      const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      
      return sessionDateOnly >= todayOnly;
    })
    .sort((a, b) => {
      const dateComparison = a.session_date.localeCompare(b.session_date);
      if (dateComparison !== 0) return dateComparison;
      return a.session_time.localeCompare(b.session_time);
    });
  
  return upcomingSessions.length > 0 ? upcomingSessions[0] : null;
};

export const getDateDisplayClasses = (dateString: string): string => {
  const relativeDate = getRelativeDate(dateString);
  
  if (relativeDate === "Today" || relativeDate === "Tomorrow") {
    return "text-primary font-medium";
  }
  
  return "text-foreground";
};