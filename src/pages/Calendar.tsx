import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import { formatDate, formatTime, getUserLocale } from "@/lib/utils";
import { isToday } from "date-fns";
import {
  PageHeader,
  PageHeaderSearch,
  PageHeaderActions,
} from "@/components/ui/page-header";
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
import { useTranslation } from "react-i18next";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { SegmentedControl } from "@/components/ui/segmented-control";

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
  const { t } = useTranslation("pages");

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
  }, []);

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
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedProjectLeadName, setSelectedProjectLeadName] = useState("");
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userLocale = getUserLocale();

  const refreshCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ["optimized-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["optimized-activities"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-reference-data"] });
  };

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
    [leadsMap]
  );

  const handleViewFullDetails = useCallback(() => {
    if (selectedProject) {
      navigate(`/projects/${selectedProject.id}`);
      setProjectDialogOpen(false);
    }
  }, [selectedProject, navigate]);

  const handleSessionClick = useCallback((session: Session) => {
    setSelectedSessionId(session.id);
    setSessionSheetOpen(true);
  }, []);

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

  // Performance monitoring for renders
  useEffect(() => {
    startRenderTiming();

    return () => {
      endRenderTiming();
    };
  });

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
            subtitle={t("calendar.description")}
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
      <>
        <PageHeader
          title={t("calendar.title")}
          subtitle={t("calendar.description")}
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
                <span>{t("calendar.filters.sessions")}</span>
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
                <span>{t("calendar.filters.reminders")}</span>
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
        <div className="lg:hidden px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 pb-4">
            {/* View mode toggle for mobile */}
            <SegmentedControl
              size="md"
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              options={viewModeOptions}
            />

            {/* Navigation for mobile */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-xs"
              >
                {t("calendar.navigation.today")}
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title for mobile */}
          <div className="text-center pb-2">
            <div className="text-lg font-semibold">{getViewTitle()}</div>
          </div>

          {/* Filter chips for mobile */}
          <div className="flex items-center gap-2 pb-4">
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
              <span>{t("calendar.filters.sessions")}</span>
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
              <span>{t("calendar.filters.reminders")}</span>
            </button>
          </div>
        </div>

        {/* Main calendar container with proper structure */}
        <div className="flex-1 px-4 sm:px-6 lg:px-6 pb-4">
          {/* Calendar content */}
          <div
            className="min-h-96"
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
              onOpenChange={setSessionSheetOpen}
              onViewFullDetails={() => {
                navigate(`/sessions/${selectedSessionId}`);
                setSessionSheetOpen(false);
              }}
              onNavigateToLead={(leadId) => navigate(`/leads/${leadId}`)}
              onNavigateToProject={(projectId) => openProjectById(projectId)}
            />
          )}
        </div>
      </>
    </CalendarErrorWrapper>
  );
}
