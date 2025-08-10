import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { formatDate, formatTime, getUserLocale, getStartOfWeek, getEndOfWeek } from "@/lib/utils";
import { addDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isToday, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, isSameDay, startOfDay, endOfDay } from "date-fns";

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
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("calendar:viewMode") as ViewMode) || "month");
  const userLocale = getUserLocale();
  
  useEffect(() => {
    localStorage.setItem("calendar:viewMode", viewMode);
  }, [viewMode]);

  // Fetch sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id,
          session_date,
          session_time,
          status,
          notes,
          lead_id,
          project_id
        `)
        .order("session_date", { ascending: true });
      
      if (error) throw error;
      return data as Session[];
    },
  });

  // Fetch activities (reminders)
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          id,
          content,
          reminder_date,
          reminder_time,
          type,
          lead_id,
          project_id,
          completed
        `)
        .order("reminder_date", { ascending: true });
      
      if (error) throw error;
      return data as Activity[];
    },
  });

  // Minimal data for display
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,lead_id");
      if (error) throw error;
      return data as { id: string; name: string; lead_id: string }[];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id,name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const projectsMap = useMemo(() =>
    Object.fromEntries(projects.map((p) => [p.id, p])),
  [projects]);
  const leadsMap = useMemo(() =>
    Object.fromEntries(leads.map((l) => [l.id, l])),
  [leads]);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedProjectLeadName, setSelectedProjectLeadName] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const refreshCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["activities"] });
  };

  const [showSessions, setShowSessions] = useState<boolean>(() => localStorage.getItem("calendar:showSessions") !== "false");
  const [showReminders, setShowReminders] = useState<boolean>(() => localStorage.getItem("calendar:showReminders") !== "false");
  useEffect(() => {
    localStorage.setItem("calendar:showSessions", String(showSessions));
    localStorage.setItem("calendar:showReminders", String(showReminders));
  }, [showSessions, showReminders]);
  const openProjectById = async (projectId?: string | null) => {
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
  };

  const handleSessionClick = (session: Session) => {
    if (session.project_id) {
      openProjectById(session.project_id);
    } else {
      navigate(`/leads/${session.lead_id}`);
    }
  };

  const handleActivityClick = (activity: Activity) => {
    if (activity.project_id) {
      openProjectById(activity.project_id);
    } else {
      navigate(`/leads/${activity.lead_id}`);
    }
  };
  // Navigation functions
  const goToToday = () => setCurrentDate(new Date());
  
  const navigatePrevious = () => {
    switch (viewMode) {
      case "day":
        setCurrentDate(prev => addDays(prev, -1));
        break;
      case "week":
        setCurrentDate(prev => addWeeks(prev, -1));
        break;
      case "month":
        setCurrentDate(prev => addMonths(prev, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case "day":
        setCurrentDate(prev => addDays(prev, 1));
        break;
      case "week":
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case "month":
        setCurrentDate(prev => addMonths(prev, 1));
        break;
    }
  };

  // Get events for current view
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    const daySessions = sessions
      .filter(session => session.session_date === dateStr)
      .sort((a, b) => a.session_time.localeCompare(b.session_time));
      
    const dayActivities = activities
      .filter(activity => {
        const activityDate = format(new Date(activity.reminder_date), "yyyy-MM-dd");
        return activityDate === dateStr;
      })
      .sort((a, b) => {
        if (!a.reminder_time && !b.reminder_time) return 0;
        if (!a.reminder_time) return 1;
        if (!b.reminder_time) return -1;
        return a.reminder_time.localeCompare(b.reminder_time);
      });
    
    return { sessions: daySessions, activities: dayActivities };
  };

  // Render view content
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
            <div key={index} className="p-3 text-sm font-medium text-muted-foreground text-center">
              {day}
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
              <div
                key={index}
                className={`
                  min-h-24 p-2 bg-card hover:bg-accent/50 transition-colors
                  ${!isCurrentMonth ? "text-muted-foreground" : ""}
                  ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : ""}
                `}
              >
                <div className={`text-sm font-medium mb-1 ${isDayToday ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                
                {/* Events */}
                <div className="space-y-1">
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

                    // Allow up to 4 visible lines when space permits
                    const maxVisible = 4;
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
                                    className={`w-full text-left text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate border border-border hover:bg-accent ${activity.completed ? "line-through opacity-60" : ""}`}
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

                        {extras.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground cursor-help">
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
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = getStartOfWeek(currentDate, userLocale);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day, index) => {
            const { sessions: daySessions, activities: dayActivities } = getEventsForDate(day);
            const isDayToday = isToday(day);
            
            return (
              <div key={index} className={`p-4 border-r border-border last:border-r-0 ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : ""}`}>
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
                                  className="w-full text-left text-xs p-2 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors cursor-pointer"
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
                                  className={`w-full text-left text-xs p-2 rounded-md bg-muted text-muted-foreground border border-border hover:bg-accent transition-colors cursor-pointer ${activity.completed ? "line-through opacity-60" : ""}`}
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
      </div>
    );
  };

  const renderDayView = () => {
    const { sessions: daySessions, activities: dayActivities } = getEventsForDate(currentDate);
    const isDayToday = isToday(currentDate);
    
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        
        <div className="space-y-4">
          {showSessions && (
            <div>
              <h3 className="text-lg font-medium mb-3 text-primary">Sessions</h3>
              {daySessions.length > 0 ? (
                <div className="space-y-2">
                  {daySessions.map((session) => {
                    const leadName = leadsMap[session.lead_id]?.name || "Lead";
                    const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                    return (
                      <button
                        key={session.id}
                        className="w-full text-left p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15"
                        onClick={() => handleSessionClick(session)}
                      >
                        <div className="font-semibold">{formatTime(session.session_time, userLocale)}</div>
                        <div className="truncate">{leadName}</div>
                        {projectName && <div className="truncate">{projectName}</div>}
                        {session.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{session.notes}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No sessions scheduled</p>
              )}
            </div>
          )}
          
          {showReminders && (
            <div>
              <h3 className="text-lg font-medium mb-3">Reminders</h3>
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
                        className={`w-full text-left p-3 rounded-lg bg-muted border border-border hover:bg-accent ${activity.completed ? 'line-through opacity-60' : ''}`}
                        onClick={() => handleActivityClick(activity)}
                      >
                        <div className="font-semibold">{timeText}</div>
                        <div className="truncate">{leadName}</div>
                        {projectName && <div className="truncate">{projectName}</div>}
                        {activity.content && (
                          <div className="text-xs text-muted-foreground mt-1">{activity.content}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No reminders</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const getViewTitle = () => {
    switch (viewMode) {
      case "day":
        return format(currentDate, "MMMM d, yyyy", { locale: undefined });
      case "week":
        const weekStart = getStartOfWeek(currentDate, userLocale);
        const weekEnd = getEndOfWeek(currentDate, userLocale);
        return `${format(weekStart, "MMM d", { locale: undefined })} - ${format(weekEnd, "MMM d, yyyy", { locale: undefined })}`;
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: undefined });
    }
  };

  return (
    <>
      <div className="p-6 space-y-6 w-full">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Calendar</h1>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* View controls */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{getViewTitle()}</h2>
            
            <div className="flex items-center gap-3">
              {/* Legend + filters (clickable chips) */}
              <div className="flex items-center gap-2" aria-label="Filter calendar items">
                <button
                  type="button"
                  aria-pressed={showSessions}
                  onClick={() => setShowSessions((v) => !v)}
                  className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors
                    ${showSessions ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${showSessions ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                  <span>Sessions</span>
                </button>
                <button
                  type="button"
                  aria-pressed={showReminders}
                  onClick={() => setShowReminders((v) => !v)}
                  className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors
                    ${showReminders ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${showReminders ? 'bg-muted-foreground/80' : 'bg-muted-foreground/40'}`} />
                  <span>Reminders</span>
                </button>
              </div>

              {/* View mode */}
              <div className="flex bg-muted rounded-lg p-1">
                {( ["day", "week", "month"] as ViewMode[] ).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`
                      px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize
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

          {/* Calendar content */}
          <div className="min-h-96">
            {viewMode === "month" && renderMonthView()}
            {viewMode === "week" && renderWeekView()}
            {viewMode === "day" && renderDayView()}
          </div>
        </div>

        {selectedProject && (
          <ViewProjectDialog
            project={selectedProject}
            open={projectDialogOpen}
            onOpenChange={(open) => { setProjectDialogOpen(open); if (!open) refreshCalendar(); }}
            onProjectUpdated={refreshCalendar}
            leadName={selectedProjectLeadName}
          />
        )}
    </>
  );
}