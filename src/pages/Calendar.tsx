import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { formatDate, formatTime, getUserLocale, getStartOfWeek, getEndOfWeek } from "@/lib/utils";
import { addDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isToday, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, isSameDay, startOfDay, endOfDay } from "date-fns";
import { PageHeader, PageHeaderSearch, PageHeaderActions } from "@/components/ui/page-header";
import SessionSheetView from "@/components/SessionSheetView";
import { useOptimizedCalendarData } from "@/hooks/useOptimizedCalendarData";
import { useOptimizedCalendarEvents } from "@/hooks/useOptimizedCalendarEvents";
import { CalendarErrorWrapper } from "@/components/calendar/CalendarErrorBoundary";
import { CalendarSkeleton, CalendarWeekSkeleton, CalendarDaySkeleton } from "@/components/calendar/CalendarSkeleton";
import { CalendarDay } from "@/components/calendar/CalendarDay";
import { CalendarWeek } from "@/components/calendar/CalendarWeek";
import { useOptimizedCalendarViewport } from "@/hooks/useOptimizedCalendarViewport";
import { useOptimizedCalendarNavigation } from "@/hooks/useOptimizedCalendarNavigation";
import { useOptimizedTouchHandlers } from "@/hooks/useOptimizedTouchHandlers";
import { useCalendarPerformanceMonitor } from "@/hooks/useCalendarPerformanceMonitor";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "day" | "week" | "month";

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

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Default to 'day' on mobile, 'month' on desktop
    const saved = localStorage.getItem("calendar:viewMode") as ViewMode;
    if (saved) return saved;
    return window.innerWidth <= 768 ? "day" : "month";
  });
  
  // Use optimized hooks for performance and interaction
  const { isMobile, isTablet, isDesktop, viewConfig, handleDayClick } = useOptimizedCalendarViewport(
    viewMode, 
    setViewMode, 
    setCurrentDate
  );
  
  const { navigatePrevious, navigateNext, goToToday, viewTitle, handleKeyboardNavigation } = useOptimizedCalendarNavigation(
    currentDate,
    viewMode,
    setCurrentDate
  );

  // Performance monitoring
  const { 
    startRenderTiming, 
    endRenderTiming, 
    startQueryTiming, 
    endQueryTiming,
    startEventProcessing,
    endEventProcessing,
    getPerformanceSummary 
  } = useCalendarPerformanceMonitor();

  // Optimized touch handlers using event delegation
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useOptimizedTouchHandlers({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrevious,
    enabled: viewConfig.enableSwipeNavigation
  });
  
  useEffect(() => {
    localStorage.setItem("calendar:viewMode", viewMode);
  }, [viewMode]);

  // Use optimized calendar data hook with performance monitoring
  useEffect(() => {
    startQueryTiming();
  }, []);

  const { 
    sessions, 
    activities, 
    projects, 
    leads, 
    projectsMap, 
    leadsMap, 
    isLoading, 
    error 
  } = useOptimizedCalendarData(currentDate, viewMode);

  useEffect(() => {
    if (!isLoading) {
      endQueryTiming();
    }
  }, [isLoading, endQueryTiming]);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedProjectLeadName, setSelectedProjectLeadName] = useState("");
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userLocale = getUserLocale();

  const refreshCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ["optimized-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["optimized-activities"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-reference-data"] });
  };

  const [showSessions, setShowSessions] = useState<boolean>(() => localStorage.getItem("calendar:showSessions") !== "false");
  const [showReminders, setShowReminders] = useState<boolean>(() => localStorage.getItem("calendar:showReminders") !== "false");
  useEffect(() => {
    localStorage.setItem("calendar:showSessions", String(showSessions));
    localStorage.setItem("calendar:showReminders", String(showReminders));
  }, [showSessions, showReminders]);

  // Use optimized events processing with performance monitoring
  const { getEventsForDate, eventStats } = useOptimizedCalendarEvents(
    sessions,
    activities,
    showSessions,
    showReminders
  );

  // Monitor event processing performance
  useEffect(() => {
    if (sessions.length > 0 || activities.length > 0) {
      startEventProcessing();
      // Processing happens in the hook, so we end timing after a tick
      const timeout = setTimeout(() => {
        endEventProcessing(eventStats.totalEvents);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [sessions, activities, startEventProcessing, endEventProcessing, eventStats.totalEvents]);
  // Memoized event handlers for better performance
  const openProjectById = useCallback(async (projectId?: string | null) => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (!error && data) {
      setSelectedProject(data);
      setSelectedProjectLeadName(leadsMap[data.lead_id]?.name || "");
      setProjectDialogOpen(true);
    }
  }, [leadsMap]);

  const handleSessionClick = useCallback((session: Session) => {
    setSelectedSessionId(session.id);
    setSessionSheetOpen(true);
  }, []);

  const handleActivityClick = useCallback((activity: Activity) => {
    if (activity.project_id) {
      openProjectById(activity.project_id);
    } else {
      navigate(`/leads/${activity.lead_id}`);
    }
  }, [openProjectById, navigate]);
  // Performance monitoring for renders
  useEffect(() => {
    startRenderTiming();
    
    return () => {
      endRenderTiming();
    };
  });

  // Keyboard navigation support
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    return () => document.removeEventListener('keydown', handleKeyboardNavigation);
  }, [handleKeyboardNavigation]);

  // Render month view using optimized CalendarDay components
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: userLocale === 'en-US' ? 0 : 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: userLocale === 'en-US' ? 0 : 1 });
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(calendarStart, i);
      return format(day, "EEE", { locale: undefined });
    });

    return (
      <div className="bg-card rounded-xl border border-border shadow-sm">
        {/* Week header */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day, index) => (
            <div key={index} className="p-2 md:p-3 text-xs md:text-sm font-medium text-muted-foreground text-center">
              <span className="md:hidden">{day.charAt(0)}</span>
              <span className="hidden md:inline">{day}</span>
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-border">
          {days.map((day, index) => {
            const { sessions: daySessions, activities: dayActivities } = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDayToday = isToday(day);
            
            return (
              <button
                key={index}
                onClick={() => {
                  if (window.innerWidth <= 768) {
                    setCurrentDate(day);
                    setViewMode("day");
                  }
                }}
                className={`
                  min-h-16 md:min-h-24 p-1 md:p-2 bg-card hover:bg-accent/50 transition-colors relative
                  ${!isCurrentMonth ? "text-muted-foreground" : ""}
                  ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : ""}
                  ${window.innerWidth <= 768 ? "min-h-11 cursor-pointer" : ""}
                `}
              >
                {/* Day number in top right corner */}
                <div className={`absolute top-1 right-1 md:top-2 md:right-2 text-xs md:text-sm font-medium ${isDayToday ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                
                {/* Events - with top margin to avoid overlap with day number */}
                <div className="space-y-0.5 mt-6 md:mt-8">
                  {(() => {
                    const sessionsList = showSessions ? daySessions : [];
                    const remindersList = showReminders ? dayActivities : [];

                    // Defensive sorting
                    const sortedSessions = [...sessionsList].sort((a, b) => a.session_time.localeCompare(b.session_time));
                    const sortedActivities = [...remindersList].sort((a, b) => {
                      if (!a.reminder_time && !b.reminder_time) return 0;
                      if (!a.reminder_time) return 1;
                      if (!b.reminder_time) return -1;
                      return a.reminder_time.localeCompare(b.reminder_time);
                    });

                    const combined = [
                      ...sortedSessions.map((s) => ({ kind: 'session' as const, item: s })),
                      ...sortedActivities.map((a) => ({ kind: 'activity' as const, item: a })),
                    ];

                     // Mobile/Tablet: max 2 dots, desktop: max 3 items
                     const maxVisible = 2;
                    const shown = combined.slice(0, maxVisible);
                    const extras = combined.slice(maxVisible);

                    const sessionExtras = extras
                      .filter((e) => e.kind === 'session')
                      .map((e) => e.item as Session)
                      .sort((a, b) => a.session_time.localeCompare(b.session_time));
                    const activityExtras = extras
                      .filter((e) => e.kind === 'activity')
                      .map((e) => e.item as Activity)
                      .sort((a, b) => {
                        if (!a.reminder_time && !b.reminder_time) return 0;
                        if (!a.reminder_time) return 1;
                        if (!b.reminder_time) return -1;
                        return a.reminder_time!.localeCompare(b.reminder_time!);
                      });

                    return (
                      <>
                        {/* Mobile/Tablet: Show dots in bottom left, Desktop: Show items */}
                        <div className="md:hidden absolute bottom-1 left-1 flex items-center gap-1">
                          {shown.map((entry, idx) => (
                            <div
                              key={idx}
                              className={`w-2 h-2 rounded-full ${
                                entry.kind === 'session' ? 'bg-primary' : 'bg-muted-foreground/60'
                              }`}
                            />
                          ))}
                          {extras.length > 0 && (
                            <div className="text-xs text-muted-foreground">+{extras.length}</div>
                          )}
                        </div>
                        
                         {/* Desktop: Show full items */}
                         <div className="hidden md:block space-y-0.5">
                           {shown.map((entry) => {
                            if (entry.kind === 'session') {
                              const session = entry.item as Session;
                              const leadName = leadsMap[session.lead_id]?.name || "Lead";
                              const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                              const line = `${formatTime(session.session_time, userLocale)} ${leadName}${projectName ? " • " + projectName : ""}`;
                              return (
                                <Tooltip key={`s-${session.id}`}>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate border hover:bg-primary/15 ${isDayToday ? 'bg-primary/15 border-primary/30' : 'bg-primary/10 border-primary/20'} text-primary`}
                                      onClick={() => handleSessionClick(session)}
                                    >
                                      {line}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="text-sm font-medium">{projectName || "Session"}</div>
                                    <div className="text-xs text-muted-foreground">{leadName}</div>
                                    <div className="text-xs text-muted-foreground">{formatDate(session.session_date)} • {formatTime(session.session_time, userLocale)}</div>
                                    {session.notes && <div className="mt-1 text-xs">{session.notes}</div>}
                                    <div className="text-xs">Status: <span className="capitalize">{session.status}</span></div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            } else {
                              const activity = entry.item as Activity;
                              const leadName = leadsMap[activity.lead_id]?.name || "Lead";
                              const projectName = activity.project_id ? projectsMap[activity.project_id!]?.name : undefined;
                              const timeText = activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day";
                              const line = `${timeText} ${leadName}${projectName ? " • " + projectName : ""}`;
                              return (
                                <Tooltip key={`a-${activity.id}`}>
                                  <TooltipTrigger asChild>
                                     <button
                                       className={`w-full text-left text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate border border-border hover:bg-accent hover:text-accent-foreground ${activity.completed ? "line-through opacity-60" : ""}`}
                                       onClick={() => handleActivityClick(activity)}
                                    >
                                      {line}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="text-sm font-medium">{activity.content}</div>
                                    <div className="text-xs text-muted-foreground">{formatDate(activity.reminder_date)} • {timeText}</div>
                                    <div className="text-xs text-muted-foreground">{projectName ? `Project: ${projectName}` : `Lead: ${leadName}`}</div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                           })}
                         </div>

                        {/* Desktop overflow tooltip */}
                        {window.innerWidth > 768 && extras.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground cursor-help text-left">
                                +{extras.length} more
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {sessionExtras.length > 0 && (
                                <div className="mb-1">
                                  <div className="text-xs font-medium mb-1">Sessions</div>
                                  <ul className="space-y-0.5">
                                    {sessionExtras.map((session) => {
                                      const leadName = leadsMap[session.lead_id]?.name || "Lead";
                                      const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                                      const timeText = formatTime(session.session_time, userLocale);
                                      return (
                                        <li key={session.id} className="text-xs">
                                          <span className="font-semibold">{timeText}</span> {leadName}{projectName ? ` • ${projectName}` : ""}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                              {activityExtras.length > 0 && (
                                <div>
                                  <div className="text-xs font-medium mb-1">Reminders</div>
                                  <ul className="space-y-0.5">
                                    {activityExtras.map((activity) => {
                                      const leadName = leadsMap[activity.lead_id]?.name || "Lead";
                                      const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
                                      const timeText = activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day";
                                      return (
                                        <li key={activity.id} className={`text-xs ${activity.completed ? "line-through opacity-60" : ""}`}>
                                          <span className="font-semibold">{timeText}</span> {leadName}{projectName ? ` • ${projectName}` : ""}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    );
                  })()}

                
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = getStartOfWeek(currentDate, userLocale);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    
    // Mobile: Single column stacked layout
    if (window.innerWidth <= 768) {
      return (
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="space-y-3 lg:space-y-0 lg:space-x-3 lg:flex lg:overflow-x-auto p-4">
            {weekDays.map((day, index) => {
              const { sessions: daySessions, activities: dayActivities } = getEventsForDate(day);
              const isDayToday = isToday(day);
              
              return (
                <div key={index} className={`p-3 rounded-lg border ${isDayToday ? "bg-primary/10 border-primary/20" : "border-border"}`}>
                  <button
                    onClick={() => {
                      setCurrentDate(day);
                      setViewMode("day");
                    }}
                    className={`text-sm font-medium mb-2 block ${isDayToday ? "text-primary" : ""} hover:text-primary transition-colors`}
                  >
                    {format(day, "EEEE, MMM d", { locale: undefined })}
                  </button>
                  
                  <div className="space-y-1">
                    {(() => {
                      const sortedSessions = [...daySessions].sort((a, b) => a.session_time.localeCompare(b.session_time));
                      const sortedActivities = [...dayActivities].sort((a, b) => {
                        if (!a.reminder_time && !b.reminder_time) return 0;
                        if (!a.reminder_time) return 1;
                        if (!b.reminder_time) return -1;
                        return a.reminder_time!.localeCompare(b.reminder_time!);
                      });

                      const allEvents = [
                        ...sortedSessions.map(s => ({ type: 'session', ...s })),
                        ...sortedActivities.map(a => ({ type: 'activity', ...a }))
                      ];

                      if (allEvents.length === 0) {
                        return <div className="text-xs text-muted-foreground">No events</div>;
                      }

                      return allEvents.slice(0, 3).map((event, idx) => {
                        if (event.type === 'session') {
                          const session = event as Session & { type: string };
                          const leadName = leadsMap[session.lead_id]?.name || "Lead";
                          const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                          return (
                            <button
                              key={`s-${session.id}`}
                              className="w-full text-left text-xs p-2 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 min-h-11"
                              onClick={() => handleSessionClick(session)}
                            >
                              <div className="font-semibold">{formatTime(session.session_time, userLocale)}</div>
                              <div className="truncate">{leadName}</div>
                            </button>
                          );
                        } else {
                          const activity = event as Activity & { type: string };
                          const leadName = leadsMap[activity.lead_id]?.name || "Lead";
                          return (
                             <button
                               key={`a-${activity.id}`}
                               className={`w-full text-left text-xs p-2 rounded bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground min-h-11 ${activity.completed ? "line-through opacity-60" : ""}`}
                               onClick={() => handleActivityClick(activity)}
                            >
                              <div className="font-semibold">{activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day"}</div>
                              <div className="truncate">{leadName}</div>
                            </button>
                          );
                        }
                      });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Desktop: Horizontal grid layout
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <ScrollArea className="w-full">
          <div className="grid grid-cols-7 border-b border-border min-w-fit">
            {weekDays.map((day, index) => {
              const { sessions: daySessions, activities: dayActivities } = getEventsForDate(day);
              const isDayToday = isToday(day);
              
              return (
                <div key={index} className={`p-4 border-r border-border last:border-r-0 min-w-32 ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : ""}`}>
                  <div className={`text-sm font-medium mb-2 ${isDayToday ? "text-primary" : ""}`}>
                    {format(day, "EEE d", { locale: undefined })}
                  </div>
                  
                  <div className="space-y-2">
                    {(() => {
                      const sortedSessions = [...daySessions].sort((a, b) => a.session_time.localeCompare(b.session_time));
                      const sortedActivities = [...dayActivities].sort((a, b) => {
                        if (!a.reminder_time && !b.reminder_time) return 0;
                        if (!a.reminder_time) return 1;
                        if (!b.reminder_time) return -1;
                        return a.reminder_time!.localeCompare(b.reminder_time!);
                      });

                      return (
                        <>
                          {showSessions && sortedSessions.map((session) => {
                            const leadName = leadsMap[session.lead_id]?.name || "Lead";
                            const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                            return (
                              <Tooltip key={session.id}>
                                <TooltipTrigger asChild>
                                  <button
                                    className="w-full text-left text-xs p-2 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors cursor-pointer min-h-11"
                                    onClick={() => handleSessionClick(session)}
                                  >
                                    <div className="font-semibold">{formatTime(session.session_time, userLocale)}</div>
                                    <div className="truncate">{leadName}</div>
                                    {projectName && <div className="truncate">{projectName}</div>}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-sm font-medium">{projectName || "Session"}</div>
                                  <div className="text-xs text-muted-foreground">{leadName}</div>
                                  <div className="text-xs text-muted-foreground">{formatDate(session.session_date)} • {formatTime(session.session_time, userLocale)}</div>
                                  {session.notes && <div className="mt-1 text-xs">{session.notes}</div>}
                                  <div className="text-xs">Status: <span className="capitalize">{session.status}</span></div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          {showReminders && sortedActivities.map((activity) => {
                            const isProjectReminder = !!activity.project_id;
                            const leadName = leadsMap[activity.lead_id]?.name || "Lead";
                            const projectName = isProjectReminder ? projectsMap[activity.project_id!]?.name : undefined;
                            return (
                              <Tooltip key={activity.id}>
                                <TooltipTrigger asChild>
                                   <button
                                     className={`w-full text-left text-xs p-2 rounded-md bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer min-h-11 ${activity.completed ? "line-through opacity-60" : ""}`}
                                     onClick={() => handleActivityClick(activity)}
                                  >
                                    <div className="font-semibold">{activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day"}</div>
                                    <div className="truncate">{leadName}</div>
                                    {projectName && <div className="truncate">{projectName}</div>}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-sm font-medium">{activity.content}</div>
                                  <div className="text-xs text-muted-foreground">{formatDate(activity.reminder_date)} • {activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day"}</div>
                                  <div className="text-xs text-muted-foreground">{projectName ? `Project: ${projectName}` : `Lead: ${leadName}`}</div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderDayView = () => {
    const { sessions: daySessions, activities: dayActivities } = getEventsForDate(currentDate);
    const isDayToday = isToday(currentDate);
    
    return (
      <div 
        className="bg-card rounded-xl border border-border shadow-sm p-4 md:p-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        <div className="space-y-4">
          {showSessions && (
            <div>
              <h3 className="text-base md:text-lg font-medium mb-3 text-primary">Sessions</h3>
              {daySessions.length > 0 ? (
                <div className="space-y-2">
                  {daySessions.map((session) => {
                    const leadName = leadsMap[session.lead_id]?.name || "Lead";
                    const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                    return (
                      <button
                        key={session.id}
                        className="w-full text-left p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 min-h-11"
                        onClick={() => handleSessionClick(session)}
                      >
                        <div className="flex items-center gap-2 text-sm md:text-base">
                          <span className="font-semibold">{formatTime(session.session_time, userLocale)}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="truncate">{leadName}</span>
                          {projectName && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate text-sm">{projectName}</span>
                            </>
                          )}
                        </div>
                        {session.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{session.notes}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-lg">
                  <p className="text-sm">No sessions scheduled</p>
                </div>
              )}
            </div>
          )}
          
          {showReminders && (
            <div>
              <h3 className="text-base md:text-lg font-medium mb-3">Reminders</h3>
              {dayActivities.length > 0 ? (
                <div className="space-y-2">
                  {dayActivities.map((activity) => {
                    const isProjectReminder = !!activity.project_id;
                    const leadName = leadsMap[activity.lead_id]?.name || "Lead";
                    const projectName = isProjectReminder ? projectsMap[activity.project_id!]?.name : undefined;
                    const timeText = activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day";
                    return (
                       <button
                         key={activity.id}
                         className={`w-full text-left p-3 rounded-lg bg-muted border border-border hover:bg-accent hover:text-accent-foreground min-h-11 ${activity.completed ? 'line-through opacity-60' : ''}`}
                         onClick={() => handleActivityClick(activity)}
                      >
                        <div className="flex items-center gap-2 text-sm md:text-base">
                          <span className="font-semibold">{timeText}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="truncate">{leadName}</span>
                          {projectName && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate text-sm">{projectName}</span>
                            </>
                          )}
                        </div>
                        {activity.content && (
                          <div className="text-xs text-muted-foreground mt-1">{activity.content}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-lg">
                  <p className="text-sm">No reminders</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const getViewTitle = () => {
    return viewTitle; // Use optimized viewTitle from hook
  };

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <CalendarErrorWrapper error={error} retry={refreshCalendar}>
        <>
          <PageHeader 
            title="Calendar"
            subtitle="Manage your sessions and reminders"
          />

          {/* Desktop controls in separate row */}
          <div className="hidden lg:block px-4 sm:px-6 lg:px-6">
            <div className="flex items-center gap-4 justify-between w-full pb-4">
              {/* Filter chips skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
              
              {/* Navigation skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-8" />
              </div>
              
              {/* View mode skeleton */}
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>

          {/* Calendar content skeleton */}
          <div className="flex-1 px-4 sm:px-6 lg:px-6 pb-4">
            <CalendarSkeleton />
          </div>
        </>
      </CalendarErrorWrapper>
    );
  }

  return (
    <CalendarErrorWrapper error={error} retry={refreshCalendar}>
      <>
        <PageHeader 
          title="Calendar"
          subtitle="Manage your sessions and reminders"
        />

      {/* Desktop controls in separate row */}
      <div className="hidden lg:block px-4 sm:px-6 lg:px-6">
        <div className="flex items-center gap-4 justify-between w-full pb-4">
          {/* Filter chips */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={showSessions}
              onClick={() => setShowSessions((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors
                ${showSessions ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${showSessions ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
              <span>Sessions</span>
            </button>
            <button
              type="button"
              aria-pressed={showReminders}
              onClick={() => setShowReminders((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors
                ${showReminders ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${showReminders ? 'bg-muted-foreground/80' : 'bg-muted-foreground/40'}`} />
              <span>Reminders</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Navigation controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigatePrevious} className="w-9 h-9 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext} className="w-9 h-9 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Divider */}
            <div className="w-px h-6 bg-border"></div>
            
            {/* View switcher */}
            <div className="flex bg-muted rounded-lg p-1">
              {( ["day", "week", "month"] as ViewMode[] ).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium transition-colors capitalize
                    ${viewMode === mode 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-accent text-muted-foreground"
                    }
                  `}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 sm:pt-0 lg:px-6 lg:pb-6 lg:pt-0 space-y-2 lg:space-y-6">
        {/* Mobile/Tablet: Reorganized controls with reduced spacing */}
        <div className="lg:hidden space-y-1.5">
          {/* Row 1: Session/reminder switches */}
          <div className="flex items-center gap-2" aria-label="Filter calendar items">
            <button
              type="button"
              aria-pressed={showSessions}
              onClick={() => setShowSessions((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap
                ${showSessions ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
            >
              <span className={`h-2 w-2 rounded-full ${showSessions ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
              <span>Sessions</span>
            </button>
            <button
              type="button"
              aria-pressed={showReminders}
              onClick={() => setShowReminders((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap
                ${showReminders ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
            >
              <span className={`h-2 w-2 rounded-full ${showReminders ? 'bg-muted-foreground/80' : 'bg-muted-foreground/40'}`} />
              <span>Reminders</span>
            </button>
          </div>
          
          {/* Row 2: Today and arrows */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} className="h-8 px-3 text-xs">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigatePrevious} className="h-8 w-8 p-0">
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext} className="h-8 w-8 p-0">
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Row 3: Day/week/Month view switcher */}
          <div className="inline-flex bg-muted rounded-lg p-0.5">
            {( ["day", "week", "month"] as ViewMode[] ).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`
                  px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors capitalize
                  ${viewMode === mode 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent text-muted-foreground"
                  }
                `}
              >
                {mode}
              </button>
            ))}
          </div>
          
          {/* Date display for mobile/tablet */}
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <h2 className="text-lg font-semibold">{getViewTitle()}</h2>
          </div>
        </div>

        {/* Desktop: Period display above calendar */}
        <div className="hidden lg:block">
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <h2 className="text-2xl font-bold">{getViewTitle()}</h2>
          </div>
        </div>

        {/* Calendar content */}
        <div 
          className="min-h-96"
          onTouchStart={viewMode !== 'month' ? handleTouchStart : undefined}
          onTouchMove={viewMode !== 'month' ? handleTouchMove : undefined}
          onTouchEnd={viewMode !== 'month' ? handleTouchEnd : undefined}
        >
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "day" && renderDayView()}
        </div>
      </div>

        {selectedProject && (
          <ViewProjectDialog
            project={selectedProject}
            open={projectDialogOpen}
            onOpenChange={(open) => { setProjectDialogOpen(open); if (!open) { refreshCalendar(); } }}
            onProjectUpdated={refreshCalendar}
            onActivityUpdated={refreshCalendar}
            leadName={selectedProjectLeadName}
          />
        )}

        {selectedSessionId && (
          <SessionSheetView
            sessionId={selectedSessionId}
            isOpen={sessionSheetOpen}
            onOpenChange={setSessionSheetOpen}
            onViewFullDetails={() => {
              navigate(`/sessions/${selectedSessionId}`);
              setSessionSheetOpen(false);
            }}
            onNavigateToLead={(leadId) => navigate(`/leads/${leadId}`)}
            onNavigateToProject={(projectId) => openProjectById(projectId)}
          />
        )}
      </>
    </CalendarErrorWrapper>
  );
}