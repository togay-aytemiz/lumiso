import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useLocation } from "react-router-dom";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import { formatDate, formatTime, getUserLocale } from "@/lib/utils";
import { isToday } from "date-fns";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import GlobalSearch from "@/components/GlobalSearch";
import SessionSheetView from "@/components/SessionSheetView";
import { useOptimizedCalendarData } from "@/hooks/useOptimizedCalendarData";
import { useOptimizedCalendarEvents } from "@/hooks/useOptimizedCalendarEvents";
import { CalendarErrorWrapper } from "@/components/calendar/CalendarErrorBoundary";
import {
  CalendarSkeleton,
  CalendarWeekSkeleton,
  CalendarDaySkeleton,
} from "@/components/calendar/CalendarSkeleton";
import { CalendarWeek } from "@/components/calendar/CalendarWeek";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { useOptimizedCalendarViewport } from "@/hooks/useOptimizedCalendarViewport";
import { useOptimizedCalendarNavigation } from "@/hooks/useOptimizedCalendarNavigation";
import { useOptimizedTouchHandlers } from "@/hooks/useOptimizedTouchHandlers";
import { useCalendarPerformanceMonitor } from "@/hooks/useCalendarPerformanceMonitor";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { PageVideoModal } from "@/components/PageVideoModal";
import { useTranslation } from "react-i18next";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { usePageVideoPrompt } from "@/hooks/usePageVideoPrompt";

type ViewMode = "day" | "week" | "month";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  notes?: string;
  lead_id: string;
  project_id?: string | null;
  duration_minutes?: number | null;
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

type CalendarProject = ReturnType<typeof useOptimizedCalendarData>["projects"][number];

const CALENDAR_VIDEO_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_CALENDAR_VIDEO_ID) ||
  "EBbAnm1qh_0";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Default to 'day' on mobile, 'month' on desktop
    const saved = localStorage.getItem("calendar:viewMode") as ViewMode;
    if (saved) return saved;
    return window.innerWidth <= 768 ? "day" : "month";
  });
  const { t } = useTranslation(["pages", "forms"]);
  const {
    isOpen: isCalendarVideoOpen,
    close: closeCalendarVideo,
    markCompleted: markCalendarVideoWatched,
    snooze: snoozeCalendarVideo
  } = usePageVideoPrompt({ pageKey: "calendar", snoozeDays: 1 });

  const location = useLocation();
  const viewModeOptions = useMemo(
    () => [
      { value: "day", label: t("calendar.viewModes.day") },
      { value: "week", label: t("calendar.viewModes.week") },
      { value: "month", label: t("calendar.viewModes.month") },
    ],
    [t],
  );

  // Use optimized hooks for performance and interaction
  const { isMobile, isTablet, isDesktop, viewConfig, handleDayClick } =
    useOptimizedCalendarViewport(viewMode, setViewMode, setCurrentDate);

  const {
    navigatePrevious,
    navigateNext,
    goToToday,
    viewTitle,
    handleKeyboardNavigation,
  } = useOptimizedCalendarNavigation(currentDate, viewMode, setCurrentDate);

  // Performance monitoring
  const {
    startRenderTiming,
    endRenderTiming,
    startQueryTiming,
    endQueryTiming,
    startEventProcessing,
    endEventProcessing,
    getPerformanceSummary,
  } = useCalendarPerformanceMonitor();

  // Organization settings to prevent time format switching during load
  const { loading: orgSettingsLoading } = useOrganizationSettings();

  // Optimized touch handlers using event delegation
  const touchHandlers = useOptimizedTouchHandlers({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrevious,
    enabled: viewConfig.enableSwipeNavigation,
  });

  useEffect(() => {
    localStorage.setItem("calendar:viewMode", viewMode);
  }, [viewMode]);

  // Use optimized calendar data hook with performance monitoring
  useEffect(() => {
    startQueryTiming();
  }, [startQueryTiming]);

  const {
    sessions,
    activities,
    projects,
    leads,
    projectsMap,
    leadsMap,
    isLoading,
    error,
  } = useOptimizedCalendarData(currentDate, viewMode);

  useEffect(() => {
    if (!isLoading) {
      endQueryTiming();
    }
  }, [isLoading, endQueryTiming]);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<CalendarProject | null>(null);
  const [selectedProjectLeadName, setSelectedProjectLeadName] = useState("");
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userLocale = getUserLocale();
  const { toast } = useToast();

  const refreshCalendar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["optimized-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["optimized-activities"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-reference-data"] });
  }, [queryClient]);

  // Throttle refresh on window focus/visibility to avoid request bursts
  useThrottledRefetchOnFocus(refreshCalendar, 30_000);

  const [showSessions, setShowSessions] = useState<boolean>(
    () => localStorage.getItem("calendar:showSessions") !== "false"
  );
  const [showReminders, setShowReminders] = useState<boolean>(
    () => localStorage.getItem("calendar:showReminders") !== "false"
  );
  useEffect(() => {
    localStorage.setItem("calendar:showSessions", String(showSessions));
    localStorage.setItem("calendar:showReminders", String(showReminders));
  }, [showSessions, showReminders]);
  const [togglingActivityId, setTogglingActivityId] = useState<string | null>(null);

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
  }, [
    sessions,
    activities,
    startEventProcessing,
    endEventProcessing,
    eventStats.totalEvents,
  ]);

  // Memoized event handlers for better performance
  const openProjectById = useCallback(
    async (projectId?: string | null) => {
      if (!projectId) return;
      if (isMobile) {
        navigate(`/projects/${projectId}`);
        return;
      }
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
    },
    [isMobile, leadsMap, navigate]
  );

  const handleViewFullDetails = useCallback(() => {
    if (selectedProject) {
      navigate(`/projects/${selectedProject.id}`);
      setProjectDialogOpen(false);
    }
  }, [selectedProject, navigate]);

  const handleSessionClick = useCallback(
    (session: Session) => {
      if (isMobile) {
        navigate(`/sessions/${session.id}`);
        return;
      }
      setSelectedSessionId(session.id);
      setSessionSheetOpen(true);
    },
    [isMobile, navigate]
  );

  const handleActivityClick = useCallback(
    (activity: Activity) => {
      if (activity.project_id) {
        openProjectById(activity.project_id);
      } else {
        navigate(`/leads/${activity.lead_id}`);
      }
    },
    [openProjectById, navigate]
  );

  const toggleActivityCompletion = useCallback(
    async (activity: Activity, nextCompleted: boolean) => {
      if (togglingActivityId) return;
      setTogglingActivityId(activity.id);
      try {
        const { error } = await supabase
          .from("activities")
          .update({ completed: nextCompleted })
          .eq("id", activity.id);
        if (error) throw error;
        refreshCalendar();
      } catch (error) {
        const description = error instanceof Error ? error.message : "Unable to update reminder.";
        toast({
          title: t("forms:reminders.statusUpdateErrorTitle", { defaultValue: "Could not update reminder" }),
          description,
          variant: "destructive",
        });
        return;
      } finally {
        setTogglingActivityId(null);
      }
      toast({
        title: nextCompleted
          ? t("forms:reminders.markCompleteSuccessTitle", { defaultValue: "Reminder marked as completed" })
          : t("forms:reminders.markIncompleteSuccessTitle", { defaultValue: "Reminder reopened" }),
        description: t("forms:reminders.statusUpdateDescription", { defaultValue: "Status updated." }),
      });
    },
    [refreshCalendar, t, toast, togglingActivityId]
  );

  // Performance monitoring for renders
  useEffect(() => {
    // Measure first paint only; avoid capturing full component lifetime
    startRenderTiming();
    const frame = requestAnimationFrame(() => {
      endRenderTiming();
    });
    return () => cancelAnimationFrame(frame);
  }, [startRenderTiming, endRenderTiming]);

  // Keyboard navigation support
  useEffect(() => {
    document.addEventListener("keydown", handleKeyboardNavigation);
    return () =>
      document.removeEventListener("keydown", handleKeyboardNavigation);
  }, [handleKeyboardNavigation]);

  // Render month view using optimized components
  const renderMonthView = () => {
    return (
      <CalendarMonthView
        currentDate={currentDate}
        getEventsForDate={getEventsForDate}
        showSessions={showSessions}
        showReminders={showReminders}
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        onSessionClick={handleSessionClick}
        onActivityClick={handleActivityClick}
        onToggleReminderCompletion={toggleActivityCompletion}
        completingReminderId={togglingActivityId}
        onDayClick={
          isMobile
            ? (date) => {
                setCurrentDate(date);
                setViewMode("day");
              }
            : undefined
        }
        isMobile={isMobile}
        touchHandlers={touchHandlers}
        fullHeight={!isMobile}
        className={!isMobile ? "h-full" : undefined}
      />
    );
  };

  // Render week view using optimized CalendarWeek component
  const renderWeekView = () => {
    return (
      <CalendarWeek
        currentDate={currentDate}
        sessions={sessions}
        activities={activities}
        showSessions={showSessions}
        showReminders={showReminders}
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        onSessionClick={handleSessionClick}
        onActivityClick={handleActivityClick}
        onDayClick={
          isMobile
            ? (date) => {
                setCurrentDate(date);
              }
            : undefined
        }
        isMobile={isMobile}
        getEventsForDate={getEventsForDate}
        onToggleReminderCompletion={toggleActivityCompletion}
        completingReminderId={togglingActivityId}
        maxHeight={!isMobile ? "calc(100vh - 220px)" : undefined}
        className={!isMobile ? "h-full" : undefined}
      />
    );
  };

  // Render day view using optimized component
  const renderDayView = () => {
    return (
      <CalendarDayView
        currentDate={currentDate}
        getEventsForDate={getEventsForDate}
        showSessions={showSessions}
        showReminders={showReminders}
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        onSessionClick={handleSessionClick}
        onActivityClick={handleActivityClick}
        onToggleReminderCompletion={toggleActivityCompletion}
        completingReminderId={togglingActivityId}
        touchHandlers={touchHandlers}
      />
    );
  };

  const getViewTitle = () => {
    return viewTitle; // Use optimized viewTitle from hook
  };

  // Show loading state while data is being fetched OR organization settings are loading
  if (isLoading || orgSettingsLoading) {
    return (
      <CalendarErrorWrapper error={error} retry={refreshCalendar}>
        <>
          <PageHeader
            title={t("calendar.title")}
            helpTitle={t("calendar.video.title", { defaultValue: "2 dakikalık hızlı tur" })}
            helpDescription={t("calendar.video.description", {
              defaultValue: "Takvimi nasıl kullanacağınızı kısaca görün."
            })}
            helpVideoId={CALENDAR_VIDEO_ID}
            helpVideoTitle={t("calendar.video.title", { defaultValue: "See how Calendar works" })}
          >
            <PageHeaderSearch>
              <GlobalSearch variant="header" />
            </PageHeaderSearch>
          </PageHeader>

          {/* Desktop controls in separate row */}
          <div className="hidden lg:block px-4 sm:px-6 lg:px-6 mt-4">
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
          <div className="flex-1 px-4 sm:px-6 lg:px-6 pb-4 mt-4 lg:mt-0">
            {viewMode === "month" && <CalendarSkeleton />}
            {viewMode === "week" && <CalendarWeekSkeleton />}
            {viewMode === "day" && <CalendarDaySkeleton />}
          </div>
        </>
      </CalendarErrorWrapper>
    );
  }

  return (
    <CalendarErrorWrapper error={error} retry={refreshCalendar}>
      <div className="flex flex-col">
        <PageHeader
          title={t("calendar.title")}
          helpTitle={t("calendar.video.title", { defaultValue: "2 dakikalık hızlı tur" })}
          helpDescription={t("calendar.video.description", {
            defaultValue: "Takvimi nasıl kullanacağınızı kısaca görün."
          })}
          helpVideoId={CALENDAR_VIDEO_ID}
          helpVideoTitle={t("calendar.video.title", { defaultValue: "See how Calendar works" })}
        >
          <PageHeaderSearch>
            <GlobalSearch variant="header" />
          </PageHeaderSearch>
        </PageHeader>

        {/* Desktop controls in separate row */}
        <div className="hidden lg:block px-4 sm:px-6 lg:px-6 mt-4">
          <div className="flex items-center gap-4 justify-between w-full pb-4">
            {/* Filter chips */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={showSessions}
                onClick={() => setShowSessions((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors
                  ${
                    showSessions
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent"
                  }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    showSessions ? "bg-primary" : "bg-muted-foreground/40"
                  }`}
                />
                <span>
                  {showSessions
                    ? t("calendar.filters.sessions_hide", { defaultValue: "Hide sessions" })
                    : t("calendar.filters.sessions_show", { defaultValue: "Show sessions" })}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={showReminders}
                onClick={() => setShowReminders((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors
                  ${
                    showReminders
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent"
                  }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    showReminders
                      ? "bg-muted-foreground/60"
                      : "bg-muted-foreground/40"
                  }`}
                />
                <span>
                  {showReminders
                    ? t("calendar.filters.reminders_hide", { defaultValue: "Hide reminders" })
                    : t("calendar.filters.reminders_show", { defaultValue: "Show reminders" })}
                </span>
              </button>
            </div>

            {/* Navigation controls with title */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                {t("calendar.navigation.today")}
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="text-lg font-semibold ml-2">{getViewTitle()}</div>
            </div>

            {/* View mode toggle */}
            <SegmentedControl
              size="md"
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              options={viewModeOptions}
            />
          </div>
        </div>

        {/* Mobile controls */}
        <div className="lg:hidden px-4 sm:px-6 mt-4">
          <div className="flex flex-col gap-3 pb-4">
            {/* View mode toggle for mobile - full width */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (!value) return;
                setViewMode(value as ViewMode);
              }}
              className="w-full inline-flex items-center rounded-full bg-slate-100 p-0.5 text-slate-500 shadow-inner"
            >
              {viewModeOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={
                    option.ariaLabel ||
                    (typeof option.label === "string" ? option.label : undefined)
                  }
                  className="h-8 min-w-[72px] flex-1 justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap text-slate-500 data-[state=on]:bg-white data-[state=on]:text-[#6F6FFB] data-[state=on]:shadow-sm"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {/* Title and navigation */}
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold truncate">{getViewTitle()}</div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={navigatePrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="text-xs whitespace-nowrap"
                >
                  {t("calendar.navigation.today")}
                </Button>
                <Button variant="outline" size="sm" onClick={navigateNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filter chips for mobile */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={showSessions}
                onClick={() => setShowSessions((v) => !v)}
                className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors
                  ${
                    showSessions
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent"
                  }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    showSessions ? "bg-primary" : "bg-muted-foreground/40"
                  }`}
                />
                <span>
                  {showSessions
                    ? t("calendar.filters.sessions_hide", { defaultValue: "Hide sessions" })
                    : t("calendar.filters.sessions_show", { defaultValue: "Show sessions" })}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={showReminders}
                onClick={() => setShowReminders((v) => !v)}
                className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors
                  ${
                    showReminders
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent"
                  }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    showReminders
                      ? "bg-muted-foreground/60"
                      : "bg-muted-foreground/40"
                  }`}
                />
                <span>
                  {showReminders
                    ? t("calendar.filters.reminders_hide", { defaultValue: "Hide reminders" })
                    : t("calendar.filters.reminders_show", { defaultValue: "Show reminders" })}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Main calendar container with proper structure */}
        <div className="px-4 sm:px-6 lg:px-6 pb-4">
          {/* Calendar content */}
          <div
            className={isMobile ? "min-h-96" : "flex flex-col"}
            style={
              isMobile
                ? undefined
                : { height: "clamp(640px, calc(100vh - 220px), 980px)" }
            }
            onTouchStart={
              viewMode !== "month" ? touchHandlers.handleTouchStart : undefined
            }
            onTouchMove={
              viewMode !== "month" ? touchHandlers.handleTouchMove : undefined
            }
            onTouchEnd={
              viewMode !== "month" ? touchHandlers.handleTouchEnd : undefined
            }
          >
            {viewMode === "month" && renderMonthView()}
            {viewMode === "week" && renderWeekView()}
            {viewMode === "day" && renderDayView()}
          </div>

          {/* Dialogs and modals */}
          {selectedProject && (
            <ProjectSheetView
              project={selectedProject}
              leadName={selectedProjectLeadName}
              open={projectDialogOpen}
              onOpenChange={(open) => {
                setProjectDialogOpen(open);
                if (!open) {
                  refreshCalendar();
                }
              }}
              onProjectUpdated={refreshCalendar}
              onActivityUpdated={refreshCalendar}
              mode="sheet"
              onViewFullDetails={handleViewFullDetails}
            />
          )}

          {selectedSessionId && (
            <SessionSheetView
              sessionId={selectedSessionId}
              isOpen={sessionSheetOpen}
              onOpenChange={(open) => {
                setSessionSheetOpen(open);
                if (!open) {
                  refreshCalendar();
                }
              }}
              onViewFullDetails={() => {
                const currentPath = `${location.pathname}${location.search}${location.hash}`;
                navigate(`/sessions/${selectedSessionId}`, { state: { from: currentPath } });
                setSessionSheetOpen(false);
              }}
              onNavigateToLead={(leadId) => navigate(`/leads/${leadId}`)}
              onNavigateToProject={(projectId) => openProjectById(projectId)}
              onSessionUpdated={refreshCalendar}
            />
          )}

          <PageVideoModal
            open={isCalendarVideoOpen}
            onClose={closeCalendarVideo}
            videoId={CALENDAR_VIDEO_ID}
            title={t("calendar.video.title", { defaultValue: "See how Calendar works" })}
            description={t("calendar.video.description", {
              defaultValue: "Watch a quick overview to get the most out of your schedule."
            })}
            labels={{
              remindMeLater: t("calendar.video.remindLater", { defaultValue: "Remind me later" }),
              dontShowAgain: t("calendar.video.dontShow", { defaultValue: "I watched, don't show again" })
            }}
            onSnooze={snoozeCalendarVideo}
            onDontShowAgain={markCalendarVideoWatched}
          />
        </div>
      </div>
    </CalendarErrorWrapper>
  );
}
