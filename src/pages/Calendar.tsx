import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  // Default to day on mobile, month on desktop
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("calendar:viewMode") as ViewMode;
    if (saved) return saved;
    return window.innerWidth <= 768 ? "day" : "month";
  });
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const userLocale = getUserLocale();
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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
          project_id,
          leads!inner(id, name),
          projects(id, name, status_id)
        `)
        .order("session_date", { ascending: true });
      if (error) throw error;

      // Filter out sessions with invalid lead references or archived projects
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return [];
      
      // Get archived status
      const { data: archivedStatus } = await supabase
        .from('project_statuses')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', 'archived')
        .maybeSingle();
      
      const filteredSessions = (data || []).filter(session => {
        // Must have a valid lead reference (inner join ensures this)
        if (!session.leads) return false;
        
        // If session has a project, check if it's archived
        if (session.project_id && session.projects) {
          if (archivedStatus?.id && session.projects.status_id === archivedStatus.id) {
            return false;
          }
        }
        
        return true;
      });

      return filteredSessions.map(s => ({
        id: s.id,
        session_date: s.session_date,
        session_time: s.session_time,
        status: s.status,
        notes: s.notes,
        lead_id: s.lead_id,
        project_id: s.project_id
      })) as Session[];
    },
  });

  // Fetch activities (reminders)
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("reminder_date", { ascending: true });
      
      if (error) throw error;

      // Filter activities with valid reminder dates and user's leads
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return [];
      
      // Get user's leads to filter activities
      const { data: userLeads } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", userId);
      
      const userLeadIds = userLeads?.map(lead => lead.id) || [];
      
      // Get archived project status
      const { data: archivedStatus } = await supabase
        .from('project_statuses')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', 'archived')
        .maybeSingle();

      // Get all projects with their statuses to check for archived ones
      const { data: projects } = await supabase
        .from('projects')
        .select('id, status_id')
        .eq('user_id', userId);
      
      const archivedProjectIds = projects?.filter(project => 
        project.status_id === archivedStatus?.id
      ).map(project => project.id) || [];

      const filteredActivities = (data || []).filter(activity => {
        // Must have reminder_date and belong to user's leads
        if (!activity.reminder_date || !userLeadIds.includes(activity.lead_id)) {
          return false;
        }
        
        // If activity has a project, check if it's archived
        if (activity.project_id && archivedProjectIds.includes(activity.project_id)) {
          return false; // Filter out activities from archived projects
        }
        
        return true;
      });

      return filteredActivities.map(a => ({
        id: a.id,
        content: a.content,
        reminder_date: a.reminder_date,
        reminder_time: a.reminder_time,
        type: a.type,
        lead_id: a.lead_id,
        project_id: a.project_id,
        completed: a.completed
      })) as Activity[];
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
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  }, []);
  
  const navigatePrevious = useCallback(() => {
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
  }, [viewMode]);

  const navigateNext = useCallback(() => {
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
  }, [viewMode]);

  // Touch/Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchStartY.current) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;
    
    // Only process horizontal swipes (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        navigateNext();
      } else {
        navigatePrevious();
      }
    }
    
    touchStartX.current = 0;
    touchStartY.current = 0;
  };

  // Get events for current view
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    const daySessions = sessions
      .filter(session => session.session_date === dateStr)
      .sort((a, b) => a.session_time.localeCompare(b.session_time));
      
  const dayActivities = activities
    .filter(activity => {
      if (!activity.reminder_date) return false;
      try {
        const activityDate = format(new Date(activity.reminder_date), "yyyy-MM-dd");
        console.log('Activity date:', activityDate, 'Target date:', dateStr, 'Match:', activityDate === dateStr);
        return activityDate === dateStr;
      } catch (error) {
        console.error('Error parsing activity date:', activity.reminder_date, error);
        return false;
      }
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
  const renderMobileMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: userLocale === 'en-US' ? 0 : 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: userLocale === 'en-US' ? 0 : 1 });
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(calendarStart, i);
      return format(day, "EEEEE", { locale: undefined }); // Single letter for mobile
    });

    return (
      <div className="bg-card rounded-lg border border-border">
        {/* Week header */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day, index) => (
            <div key={index} className="p-2 text-xs font-medium text-muted-foreground text-center">
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
            const totalEvents = daySessions.length + dayActivities.length;
            
            return (
              <button
                key={index}
                onClick={() => {
                  setSelectedDay(day);
                  setCurrentDate(day);
                  setViewMode("day");
                }}
                className={`
                  min-h-16 p-1.5 bg-card hover:bg-accent/50 transition-colors text-left relative
                  ${!isCurrentMonth ? "text-muted-foreground opacity-50" : ""}
                  ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : ""}
                `}
                aria-label={`${format(day, "EEEE, MMMM d")}, ${totalEvents} events`}
              >
                <div className={`text-sm font-medium mb-1 ${isDayToday ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                
                {/* Event dots - max 2 visible */}
                <div className="flex flex-wrap gap-0.5">
                  {showSessions && daySessions.slice(0, 2).map((_, i) => (
                    <div key={`s-${i}`} className="w-1.5 h-1.5 rounded-full bg-primary" />
                  ))}
                  {showReminders && dayActivities.slice(0, 2 - (showSessions ? daySessions.length : 0)).map((_, i) => (
                    <div key={`a-${i}`} className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  ))}
                  {totalEvents > 2 && (
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-3 min-w-4">
                      +{totalEvents - 2}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDesktopMonthView = () => {
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

                    const maxVisible = 3;
                    const shown = combined.slice(0, maxVisible);
                    const extras = combined.slice(maxVisible);

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
                              <div className="text-xs">Click to view all events</div>
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

  const renderMobileWeekView = () => {
    const weekStart = getStartOfWeek(currentDate, userLocale);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    
    return (
      <div className="bg-card rounded-lg border border-border">
        <ScrollArea className="w-full">
          <div className="flex">
            {weekDays.map((day, index) => {
              const { sessions: daySessions, activities: dayActivities } = getEventsForDate(day);
              const isDayToday = isToday(day);
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode("day");
                  }}
                  className={`
                    flex-shrink-0 w-20 p-3 border-r border-border last:border-r-0 min-h-[200px] transition-colors
                    ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-accent/50"}
                  `}
                  aria-label={`${format(day, "EEEE, MMMM d")}, ${daySessions.length + dayActivities.length} events`}
                >
                  <div className={`text-xs font-medium mb-2 text-center ${isDayToday ? "text-primary" : ""}`}>
                    {format(day, "EEE", { locale: undefined })}
                  </div>
                  <div className={`text-lg font-bold mb-2 text-center ${isDayToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  
                  <div className="space-y-1">
                    {showSessions && daySessions.slice(0, 3).map((session, i) => (
                      <div key={`s-${i}`} className="w-full h-2 rounded-full bg-primary opacity-80" />
                    ))}
                    {showReminders && dayActivities.slice(0, 3 - (showSessions ? daySessions.length : 0)).map((activity, i) => (
                      <div key={`a-${i}`} className="w-full h-2 rounded-full bg-muted-foreground opacity-80" />
                    ))}
                    {(daySessions.length + dayActivities.length) > 3 && (
                      <div className="text-xs text-muted-foreground text-center mt-1">
                        +{(daySessions.length + dayActivities.length) - 3}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderMobileDayView = () => {
    const { sessions: daySessions, activities: dayActivities } = getEventsForDate(currentDate);
    
    return (
      <div className="space-y-4">
        {/* Sessions Section */}
        {showSessions && (
          <div>
            {daySessions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold text-primary">Sessions</h3>
                </div>
                {daySessions.map((session) => {
                  const leadName = leadsMap[session.lead_id]?.name || "Lead";
                  const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                  return (
                    <button
                      key={session.id}
                      className="w-full text-left p-4 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors min-h-[44px]"
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-primary">
                          {formatTime(session.session_time, userLocale)}
                        </div>
                        <div className="w-1 h-1 rounded-full bg-primary/50" />
                        <div className="text-sm font-medium">{projectName || "Session"}</div>
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                        <div className="text-sm text-muted-foreground">{leadName}</div>
                      </div>
                      {session.notes && (
                        <div className="text-xs text-muted-foreground mt-2">{session.notes}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border p-6 text-center">
                <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No sessions scheduled</p>
              </div>
            )}
          </div>
        )}
        
        {/* Reminders Section */}
        {showReminders && (
          <div>
            {dayActivities.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Reminders</h3>
                </div>
                {dayActivities.map((activity) => {
                  const leadName = leadsMap[activity.lead_id]?.name || "Lead";
                  const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
                  const timeText = activity.reminder_time ? formatTime(activity.reminder_time, userLocale) : "All day";
                  return (
                    <button
                      key={activity.id}
                      className={`w-full text-left p-4 rounded-lg bg-muted border border-border hover:bg-accent transition-colors min-h-[44px] ${activity.completed ? 'opacity-60' : ''}`}
                      onClick={() => handleActivityClick(activity)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold">
                          {timeText}
                        </div>
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                        <div className={`text-sm font-medium ${activity.completed ? 'line-through' : ''}`}>{activity.content}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {projectName ? `Project: ${projectName}` : `Lead: ${leadName}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border p-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No reminders</p>
              </div>
            )}
          </div>
        )}
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
      <div 
        className="w-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile Header (≤768px) */}
        <div className="md:hidden">
          {/* Row 1: H1 "Calendar" */}
          <div className="px-4 py-3 border-b border-border">
            <h1 className="text-2xl font-bold truncate">Calendar</h1>
          </div>
          
          {/* Row 2: Today button + navigation arrows */}
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Row 3: Filter chips - horizontal scroller */}
          <div className="px-4 py-2 border-b border-border">
            <ScrollArea className="w-full">
              <div className="flex items-center gap-2 pb-2">
                <button
                  type="button"
                  aria-pressed={showSessions}
                  onClick={() => setShowSessions((v) => !v)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors whitespace-nowrap min-h-[44px]
                    ${showSessions ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${showSessions ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                  <span>Sessions</span>
                </button>
                <button
                  type="button"
                  aria-pressed={showReminders}
                  onClick={() => setShowReminders((v) => !v)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors whitespace-nowrap min-h-[44px]
                    ${showReminders ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted border-border text-muted-foreground hover:bg-accent'}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${showReminders ? 'bg-muted-foreground/80' : 'bg-muted-foreground/40'}`} />
                  <span>Reminders</span>
                </button>
              </div>
            </ScrollArea>
          </div>
          
          {/* Row 4: Segmented control - Day | Week | Month */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex bg-muted rounded-lg p-1 w-full">
              {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`
                    flex-1 py-2 rounded-md text-sm font-medium transition-colors capitalize min-h-[44px] flex items-center justify-center
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

        {/* Desktop/Tablet Header (>768px) */}
        <div className="hidden md:block p-6 space-y-6">
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
                {(["day", "week", "month"] as ViewMode[]).map((mode) => (
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
        </div>

        {/* Calendar Content */}
        <div className="px-4 pb-4 md:px-6 md:pb-6">
          {/* Mobile Day View Sticky Header */}
          {viewMode === "day" && (
            <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur-sm mb-4 py-2 border-b border-border">
              <h2 className="text-lg font-semibold text-center">
                {format(currentDate, "EEEE, MMMM d, yyyy")}
              </h2>
            </div>
          )}

          <div className="min-h-96">
            {viewMode === "month" && (
              <div className="md:hidden">
                {renderMobileMonthView()}
              </div>
            )}
            {viewMode === "month" && (
              <div className="hidden md:block">
                {renderDesktopMonthView()}
              </div>
            )}
            {viewMode === "week" && renderMobileWeekView()}
            {viewMode === "day" && renderMobileDayView()}
          </div>
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
    </>
  );
}