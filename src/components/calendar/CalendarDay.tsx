import React, { memo } from 'react';
import { format, isToday, isSameMonth } from 'date-fns';
import { formatTime, getUserLocale } from '@/lib/utils';

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

interface CalendarDayProps {
  date: Date;
  currentDate: Date;
  sessions: Session[];
  activities: Activity[];
  showSessions: boolean;
  showReminders: boolean;
  leadsMap: Record<string, { id: string; name: string }>;
  projectsMap: Record<string, { id: string; name: string; lead_id: string }>;
  isMobile: boolean;
  onSessionClick: (session: Session) => void;
  onActivityClick: (activity: Activity) => void;
  onDayClick?: (date: Date) => void;
}

/**
 * Optimized calendar day component with React.memo
 * Only re-renders when props actually change
 */
export const CalendarDay = memo<CalendarDayProps>(function CalendarDay({
  date,
  currentDate,
  sessions,
  activities,
  showSessions,
  showReminders,
  leadsMap,
  projectsMap,
  isMobile,
  onSessionClick,
  onActivityClick,
  onDayClick
}) {
  const userLocale = getUserLocale();
  const isCurrentMonth = isSameMonth(date, currentDate);
  const isDayToday = isToday(date);

  // Pre-sort events for consistent rendering
  const sortedSessions = React.useMemo(() => 
    showSessions ? [...sessions].sort((a, b) => a.session_time.localeCompare(b.session_time)) : [],
    [sessions, showSessions]
  );

  const sortedActivities = React.useMemo(() => 
    showReminders ? [...activities].sort((a, b) => {
      if (!a.reminder_time && !b.reminder_time) return 0;
      if (!a.reminder_time) return 1;
      if (!b.reminder_time) return -1;
      return a.reminder_time.localeCompare(b.reminder_time);
    }) : [],
    [activities, showReminders]
  );

  // Combine and limit events for display
  const combinedEvents = React.useMemo(() => {
    const combined = [
      ...sortedSessions.map((s) => ({ kind: 'session' as const, item: s })),
      ...sortedActivities.map((a) => ({ kind: 'activity' as const, item: a })),
    ];

    const maxVisible = 2;
    const shown = combined.slice(0, maxVisible);
    const extras = combined.slice(maxVisible);

    return { shown, extras, total: combined.length };
  }, [sortedSessions, sortedActivities]);

  const handleDayClick = React.useCallback(() => {
    if (isMobile && onDayClick) {
      onDayClick(date);
    }
  }, [isMobile, onDayClick, date]);

  return (
    <button
      onClick={handleDayClick}
      className={`
        min-h-16 md:min-h-24 p-1 md:p-2 bg-card hover:bg-accent/50 transition-colors relative
        ${!isCurrentMonth ? "text-muted-foreground" : ""}
        ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : ""}
        ${isMobile ? "min-h-11 cursor-pointer" : ""}
      `}
    >
      {/* Day number in top right corner */}
      <div className={`absolute top-1 right-1 md:top-2 md:right-2 text-xs md:text-sm font-medium ${isDayToday ? "text-primary" : ""}`}>
        {format(date, "d")}
      </div>
      
      {/* Events - with top margin to avoid overlap with day number */}
      <div className="space-y-0.5 mt-6 md:mt-8">
        {/* Mobile/Tablet: Show dots in bottom left, Desktop: Show items */}
        <div className="md:hidden absolute bottom-1 left-1 flex items-center gap-1">
          {combinedEvents.shown.map((entry, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full ${
                entry.kind === 'session' ? 'bg-primary' : 'bg-muted-foreground/60'
              }`}
            />
          ))}
          {combinedEvents.extras.length > 0 && (
            <div className="text-xs text-muted-foreground">+{combinedEvents.extras.length}</div>
          )}
        </div>
        
        {/* Desktop: Show full items */}
        <div className="hidden md:block space-y-0.5">
          {combinedEvents.shown.map((entry, idx) => {
            if (entry.kind === 'session') {
              const session = entry.item as Session;
              const leadName = leadsMap[session.lead_id]?.name || "Lead";
              const timeText = formatTime(session.session_time, userLocale);
              
              return (
                <button
                  key={`session-${session.id}`}
                  className="w-full text-left px-2 py-1 rounded text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-colors truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionClick(session);
                  }}
                >
                  <div className="font-medium truncate">{timeText} • {leadName}</div>
                </button>
              );
            } else {
              const activity = entry.item as Activity;
              const leadName = leadsMap[activity.lead_id]?.name || "Lead";
              const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
              const timeText = activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day";
              
              return (
                <button
                  key={`activity-${activity.id}`}
                  className={`w-full text-left px-2 py-1 rounded text-xs bg-muted/80 text-muted-foreground hover:bg-accent transition-colors truncate ${activity.completed ? 'line-through opacity-60' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onActivityClick(activity);
                  }}
                >
                  <div className="truncate">
                    {timeText} • {leadName}
                    {projectName && ` • ${projectName}`}
                  </div>
                </button>
              );
            }
          })}
          
          {combinedEvents.extras.length > 0 && (
            <div className="text-xs text-muted-foreground text-center py-1">
              +{combinedEvents.extras.length} more
            </div>
          )}
        </div>
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal performance
  return (
    prevProps.date.getTime() === nextProps.date.getTime() &&
    prevProps.currentDate.getTime() === nextProps.currentDate.getTime() &&
    prevProps.sessions.length === nextProps.sessions.length &&
    prevProps.activities.length === nextProps.activities.length &&
    prevProps.showSessions === nextProps.showSessions &&
    prevProps.showReminders === nextProps.showReminders &&
    prevProps.isMobile === nextProps.isMobile &&
    // Deep compare sessions and activities if lengths are the same
    JSON.stringify(prevProps.sessions) === JSON.stringify(nextProps.sessions) &&
    JSON.stringify(prevProps.activities) === JSON.stringify(nextProps.activities)
  );
});