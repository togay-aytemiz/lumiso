import { Skeleton } from "@/components/ui/skeleton";

/**
 * Calendar-specific skeleton loader
 * Shows the calendar grid structure while data is loading
 */
export function CalendarSkeleton() {
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm">
      {/* Week header skeleton */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day, index) => (
          <div key={index} className="p-2 md:p-3 text-center">
            <Skeleton className="h-4 w-6 mx-auto" />
          </div>
        ))}
      </div>
      
      {/* Calendar grid skeleton - 6 weeks */}
      <div className="grid grid-cols-7 gap-px bg-border">
        {Array.from({ length: 42 }).map((_, index) => (
          <div
            key={index}
            className="min-h-16 md:min-h-24 p-1 md:p-2 bg-card relative"
          >
            {/* Day number skeleton in top right */}
            <div className="absolute top-1 right-1 md:top-2 md:right-2">
              <Skeleton className="h-3 w-4 md:h-4 md:w-5" />
            </div>
            
            {/* Event items skeleton */}
            <div className="space-y-0.5 mt-6 md:mt-8">
              {/* Mobile: dots, Desktop: event bars */}
              <div className="md:hidden absolute bottom-1 left-1 flex items-center gap-1">
                {Math.random() > 0.7 && (
                  <>
                    <Skeleton className="h-2 w-2 rounded-full" />
                    {Math.random() > 0.5 && <Skeleton className="h-2 w-2 rounded-full" />}
                  </>
                )}
              </div>
              
              {/* Desktop: event bars */}
              <div className="hidden md:block space-y-0.5">
                {Math.random() > 0.6 && (
                  <Skeleton className="h-6 w-full rounded" />
                )}
                {Math.random() > 0.8 && (
                  <Skeleton className="h-6 w-3/4 rounded" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Week view skeleton
 */
export function CalendarWeekSkeleton() {
  return (
    <div className="space-y-4">
      {/* Time slots with skeleton events */}
      {Array.from({ length: 24 }).map((_, hour) => (
        <div key={hour} className="flex gap-4">
          <div className="w-16 text-right">
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="flex-1 grid grid-cols-7 gap-2 min-h-12">
            {Array.from({ length: 7 }).map((_, day) => (
              <div key={day} className="relative">
                {Math.random() > 0.85 && (
                  <Skeleton className="h-8 w-full rounded absolute top-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Day view skeleton
 */
export function CalendarDaySkeleton() {
  return (
    <div className="space-y-4">
      {/* Sessions section */}
      <div>
        <Skeleton className="h-6 w-32 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
      
      {/* Reminders section */}
      <div>
        <Skeleton className="h-6 w-28 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}