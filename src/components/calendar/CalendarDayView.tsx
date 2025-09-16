import React, { useMemo } from "react";
import { CalendarEvent } from "./CalendarEvent";
import { VirtualizedList } from "@/components/optimized/VirtualizedList";
import { format } from "date-fns";

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
  sessions: Session[];
  activities: Activity[];
  showSessions: boolean;
  showReminders: boolean;
  leadsMap: Record<string, { name: string }>;
  projectsMap: Record<string, { name: string }>;
  onSessionClick: (session: Session) => void;
  onActivityClick: (activity: Activity) => void;
}

interface EventItem {
  id: string;
  type: "session" | "activity";
  data: Session | Activity;
  sortTime: string;
}

const CalendarDayView = React.memo(({
  currentDate,
  sessions,
  activities,
  showSessions,
  showReminders,
  leadsMap,
  projectsMap,
  onSessionClick,
  onActivityClick,
}: CalendarDayViewProps) => {
  const dayEvents = useMemo(() => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const events: EventItem[] = [];

    // Add sessions for the day
    if (showSessions) {
      const daySessions = sessions
        .filter(session => session.session_date === dateStr)
        .map(session => ({
          id: `session-${session.id}`,
          type: "session" as const,
          data: session,
          sortTime: session.session_time,
        }));
      events.push(...daySessions);
    }

    // Add activities for the day
    if (showReminders) {
      const dayActivities = activities
        .filter(activity => {
          if (!activity.reminder_date) return false;
          try {
            const activityDate = format(new Date(activity.reminder_date), "yyyy-MM-dd");
            return activityDate === dateStr;
          } catch {
            return false;
          }
        })
        .map(activity => ({
          id: `activity-${activity.id}`,
          type: "activity" as const,
          data: activity,
          sortTime: activity.reminder_time || "00:00:00",
        }));
      events.push(...dayActivities);
    }

    // Sort by time
    return events.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  }, [currentDate, sessions, activities, showSessions, showReminders]);

  const renderEvent = React.useCallback((event: EventItem) => {
    const leadName = leadsMap[event.data.lead_id]?.name || "Unknown Lead";
    const projectName = event.data.project_id ? projectsMap[event.data.project_id]?.name : undefined;

    const handleClick = () => {
      if (event.type === "session") {
        onSessionClick(event.data as Session);
      } else {
        onActivityClick(event.data as Activity);
      }
    };

    return (
      <CalendarEvent
        key={event.id}
        event={event.data}
        eventType={event.type}
        leadName={leadName}
        projectName={projectName}
        onClick={handleClick}
        className="mb-2"
      />
    );
  }, [leadsMap, projectsMap, onSessionClick, onActivityClick]);

  if (dayEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-6 rounded-lg bg-muted/50">
          <p className="text-muted-foreground">
            No {!showSessions && !showReminders ? "events" : 
                 showSessions && !showReminders ? "sessions" :
                 !showSessions && showReminders ? "reminders" : "events"} scheduled for this day
          </p>
        </div>
      </div>
    );
  }

  // Use virtual scrolling for large numbers of events (50+)
  if (dayEvents.length > 50) {
    return (
      <div className="h-[600px]">
        <VirtualizedList
          items={dayEvents}
          renderItem={renderEvent}
          itemHeight={80}
          containerHeight={600}
          aria-label={`Events for ${format(currentDate, "EEEE, MMMM d, yyyy")}`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label={`Events for ${format(currentDate, "EEEE, MMMM d, yyyy")}`}>
      {dayEvents.map(renderEvent)}
    </div>
  );
});

CalendarDayView.displayName = "CalendarDayView";

export { CalendarDayView };