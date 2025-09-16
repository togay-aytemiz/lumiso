import { Loader2 } from "lucide-react";

/**
 * Optimized loading spinner for calendar data
 * Shows while calendar data is being fetched
 */
export function CalendarLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading calendar...</p>
      </div>
    </div>
  );
}