import { memo } from "react";
import { format, isToday } from "date-fns";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatTime, formatDate, getUserLocale } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

interface CalendarDayViewProps {
  currentDate: Date;
  getEventsForDate: (date: Date) => {
    sessions: Session[];
    activities: Activity[];
  };
  showSessions: boolean;
  showReminders: boolean;
  leadsMap: Record<string, { name: string }>;
  projectsMap: Record<string, { name: string }>;
  onSessionClick: (session: Session) => void;
  onActivityClick: (activity: Activity) => void;
  touchHandlers: {
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: (e: React.TouchEvent) => void;
    handleTouchCancel: () => void;
  };
}

export const CalendarDayView = memo<CalendarDayViewProps>(({
  currentDate,
  getEventsForDate,
  showSessions,
  showReminders,
  leadsMap,
  projectsMap,
  onSessionClick,
  onActivityClick,
  touchHandlers
}) => {
  const userLocale = getUserLocale();
  const { sessions, activities } = getEventsForDate(currentDate);
  const isDayToday = isToday(currentDate);

  // Sort sessions and activities by time
  const sortedSessions = showSessions ? [...sessions].sort((a, b) => a.session_time.localeCompare(b.session_time)) : [];
  const sortedActivities = showReminders ? [...activities].sort((a, b) => {
    if (!a.reminder_time && !b.reminder_time) return 0;
    if (!a.reminder_time) return 1;
    if (!b.reminder_time) return -1;
    return a.reminder_time.localeCompare(b.reminder_time);
  }) : [];

  return (
    <div 
      className="space-y-6"
      onTouchStart={touchHandlers.handleTouchStart}
      onTouchMove={touchHandlers.handleTouchMove}
      onTouchEnd={touchHandlers.handleTouchEnd}
      onTouchCancel={touchHandlers.handleTouchCancel}
    >
      {/* Day header */}
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold">
          {format(currentDate, "EEEE, MMMM d, yyyy")}
        </h2>
        {isDayToday && (
          <Badge variant="secondary" className="mt-2">
            Today
          </Badge>
        )}
      </div>

      {/* Sessions section */}
      {showSessions && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            Sessions ({sortedSessions.length})
          </h3>
          
          {sortedSessions.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 bg-card rounded-lg border border-dashed">
              No sessions scheduled for this day
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSessions.map((session) => {
                const leadName = leadsMap[session.lead_id]?.name || "Lead";
                const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                
                return (
                  <Tooltip key={session.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSessionClick(session)}
                        className="w-full p-4 bg-card rounded-lg border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-primary mb-1">
                              {projectName || "Session"}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {leadName}
                            </div>
                            <div className="text-sm font-medium">
                              {formatTime(session.session_time, userLocale)}
                            </div>
                            {session.notes && (
                              <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {session.notes}
                              </div>
                            )}
                          </div>
                          <Badge 
                            variant={session.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {session.status}
                          </Badge>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">Click to view session details</div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Activities/Reminders section */}
      {showReminders && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/60"></div>
            Reminders ({sortedActivities.length})
          </h3>
          
          {sortedActivities.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 bg-card rounded-lg border border-dashed">
              No reminders for this day
            </div>
          ) : (
            <div className="space-y-3">
              {sortedActivities.map((activity) => {
                const leadName = leadsMap[activity.lead_id]?.name || "Lead";
                const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
                const timeText = activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day";
                
                return (
                  <Tooltip key={activity.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onActivityClick(activity)}
                        className={`w-full p-4 bg-card rounded-lg border hover:bg-accent/50 transition-colors text-left ${
                          activity.completed ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium mb-1 ${activity.completed ? 'line-through' : ''}`}>
                              {activity.content}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {projectName ? `Project: ${projectName}` : `Lead: ${leadName}`}
                            </div>
                            <div className="text-sm font-medium">
                              {timeText}
                            </div>
                          </div>
                          <Badge 
                            variant={activity.completed ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {activity.completed ? 'Completed' : activity.type}
                          </Badge>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        Click to view {activity.project_id ? 'project' : 'lead'} details
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state when both are disabled */}
      {!showSessions && !showReminders && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-lg font-medium mb-2">No events to display</div>
          <div className="text-sm">Enable sessions or reminders in the filters above</div>
        </div>
      )}
    </div>
  );
});

CalendarDayView.displayName = "CalendarDayView";