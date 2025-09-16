import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

type ViewMode = "day" | "week" | "month";

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  showSessions: boolean;
  showReminders: boolean;
  onToggleSessions: () => void;
  onToggleReminders: () => void;
}

const CalendarHeader = React.memo(({
  currentDate,
  viewMode,
  onViewModeChange,
  onNavigate,
  showSessions,
  showReminders,
  onToggleSessions,
  onToggleReminders,
}: CalendarHeaderProps) => {
  const getPeriodTitle = () => {
    switch (viewMode) {
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "week":
        return `Week of ${format(currentDate, "MMM d, yyyy")}`;
      case "month":
        return format(currentDate, "MMMM yyyy");
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("prev")}
          aria-label={`Previous ${viewMode}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          onClick={() => onNavigate("today")}
          className="text-sm font-medium min-w-[80px]"
        >
          Today
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("next")}
          aria-label={`Next ${viewMode}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        <h2 className="text-lg md:text-xl font-semibold ml-4" aria-live="polite">
          {getPeriodTitle()}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex rounded-lg border bg-background p-1">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange(mode)}
              className="px-3 capitalize"
              aria-pressed={viewMode === mode}
            >
              {mode}
            </Button>
          ))}
        </div>

        {/* Filter Toggle */}
        <div className="flex rounded-lg border bg-background p-1">
          <Button
            variant={showSessions ? "default" : "ghost"}
            size="sm"
            onClick={onToggleSessions}
            className="px-3"
            aria-pressed={showSessions}
          >
            Sessions
          </Button>
          <Button
            variant={showReminders ? "default" : "ghost"}
            size="sm"
            onClick={onToggleReminders}
            className="px-3"
            aria-pressed={showReminders}
          >
            Reminders
          </Button>
        </div>
      </div>
    </div>
  );
});

CalendarHeader.displayName = "CalendarHeader";

export { CalendarHeader };