import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  // Add touch/swipe handlers
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Swipe left - next
        navigateNext();
      } else {
        // Swipe right - previous  
        navigatePrevious();
      }
    }
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
                  min-h-16 md:min-h-24 p-1 md:p-2 bg-card hover:bg-accent/50 transition-colors text-left
                  ${!isCurrentMonth ? "text-muted-foreground" : ""}
                  ${isDayToday ? "bg-primary/10 ring-1 ring-primary/20" : ""}
                  ${window.innerWidth <= 768 ? "min-h-11 cursor-pointer" : ""}
                `}
              >
                <div className={`text-xs md:text-sm font-medium mb-1 ${isDayToday ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                
                {/* Events */}
                <div className="space-y-0.5">
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

                    // Mobile: max 2 dots, desktop: max 3 items
                    const maxVisible = window.innerWidth <= 768 ? 2 : 3;
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
                        {/* Mobile: Show dots, Desktop: Show items */}
                        {window.innerWidth <= 768 ? (
                          <div className="flex gap-1">
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
                        ) : (
                          shown.map((entry) => {
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
                          })
                        )}

                        {/* Desktop overflow tooltip */}
                        {window.innerWidth > 768 && extras.length > 0 && (
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
                              className={`w-full text-left text-xs p-2 rounded bg-muted text-muted-foreground border border-border hover:bg-accent min-h-11 ${activity.completed ? "line-through opacity-60" : ""}`}
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
                                    className={`w-full text-left text-xs p-2 rounded-md bg-muted text-muted-foreground border border-border hover:bg-accent transition-colors cursor-pointer min-h-11 ${activity.completed ? "line-through opacity-60" : ""}`}
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
        {/* Mobile: Sticky date header */}
        <div className="md:hidden mb-4 pb-3 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">
            {format(currentDate, "EEEE, MMM d, yyyy", { locale: undefined })}
          </h2>
        </div>
        
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
                        className={`w-full text-left p-3 rounded-lg bg-muted border border-border hover:bg-accent min-h-11 ${activity.completed ? 'line-through opacity-60' : ''}`}
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
      <PageHeader 
        title="Calendar"
        subtitle="Manage your sessions and reminders"
      >
        <PageHeaderActions>
          {/* Desktop: Navigation controls on far left */}
          <div className="hidden lg:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            {/* Desktop: Filter chips */}
            <div className="flex items-center gap-2 ml-4" aria-label="Filter calendar items">
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
          </div>
          
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
        </PageHeaderActions>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Mobile/Tablet: Navigation and filters */}
        <div className="lg:hidden space-y-4">
          {/* Navigation controls */}
          <div className="flex items-center justify-between">
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
            
            {/* Filter chips */}
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
          </div>
          
          {/* Month/Week range display for mobile/tablet */}
          {(viewMode === "month" || viewMode === "week") && (
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <h2 className="text-lg font-semibold">{getViewTitle()}</h2>
            </div>
          )}
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
    </>
  );
}