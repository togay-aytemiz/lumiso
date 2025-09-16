import React from "react";
import { formatTime, getUserLocale } from "@/lib/utils";

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

interface CalendarEventProps {
  event: Session | Activity;
  eventType: "session" | "activity";
  leadName: string;
  projectName?: string;
  onClick: () => void;
  className?: string;
}

const CalendarEvent = React.memo(({
  event,
  eventType,
  leadName,
  projectName,
  onClick,
  className = "",
}: CalendarEventProps) => {
  const userLocale = getUserLocale();
  
  const getEventTime = () => {
    if (eventType === "session") {
      const session = event as Session;
      return formatTime(session.session_time, userLocale);
    } else {
      const activity = event as Activity;
      return activity.reminder_time 
        ? formatTime(activity.reminder_time, userLocale) 
        : "All day";
    }
  };

  const getEventContent = () => {
    if (eventType === "session") {
      return "Session";
    } else {
      const activity = event as Activity;
      return activity.content || "Reminder";
    }
  };

  const getEventStatusClasses = () => {
    if (eventType === "session") {
      const session = event as Session;
      switch (session.status) {
        case "completed":
          return "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300";
        case "cancelled":
          return "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300";
        default:
          return "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300";
      }
    } else {
      const activity = event as Activity;
      return activity.completed
        ? "bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800/30 dark:border-gray-600 dark:text-gray-400 line-through opacity-60"
        : "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300";
    }
  };

  return (
    <button
      className={`w-full text-left p-2 rounded-md border transition-colors hover:opacity-80 focus:ring-2 focus:ring-primary focus:outline-none ${getEventStatusClasses()} ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${eventType === "session" ? "Session" : "Reminder"} with ${leadName} at ${getEventTime()}`}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        <span>{getEventTime()}</span>
        <span className="opacity-60">•</span>
        <span className="truncate">{leadName}</span>
        {projectName && (
          <>
            <span className="opacity-60">•</span>
            <span className="truncate text-xs opacity-80">{projectName}</span>
          </>
        )}
      </div>
      <div className="text-xs mt-1 truncate opacity-80">
        {getEventContent()}
      </div>
    </button>
  );
});

CalendarEvent.displayName = "CalendarEvent";

export { CalendarEvent };