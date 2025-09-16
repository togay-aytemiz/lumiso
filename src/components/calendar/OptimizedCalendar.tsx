import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarDayView } from "./CalendarDayView";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import SessionSheetView from "@/components/SessionSheetView";
import { PageHeader } from "@/components/ui/page-header";
import { addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { useScreenReader } from "@/hooks/useAccessibility";

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

interface Project {
  id: string;
  name: string;
}

interface Lead {
  id: string;
  name: string;
}

const OptimizedCalendar = React.memo(() => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { announce } = useScreenReader();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("calendar:viewMode") as ViewMode;
    if (saved) return saved;
    return window.innerWidth <= 768 ? "day" : "month";
  });
  
  const [showSessions, setShowSessions] = useState(() => {
    const saved = localStorage.getItem("calendar:showSessions");
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [showReminders, setShowReminders] = useState(() => {
    const saved = localStorage.getItem("calendar:showReminders");  
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("calendar:viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("calendar:showSessions", JSON.stringify(showSessions));
  }, [showSessions]);

  useEffect(() => {
    localStorage.setItem("calendar:showReminders", JSON.stringify(showReminders));
  }, [showReminders]);

  // Optimized data fetching with parallel queries
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["calendar-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, session_date, session_time, status, notes, lead_id, project_id")
        .order("session_date", { ascending: true })
        .order("session_time", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["calendar-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, content, reminder_date, reminder_time, type, lead_id, project_id, completed")
        .not("reminder_date", "is", null)
        .order("reminder_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["calendar-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["calendar-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name");
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Memoized maps for efficient lookups
  const projectsMap = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, Project>);
  }, [projects]);

  const leadsMap = useMemo(() => {
    return leads.reduce((acc, lead) => {
      acc[lead.id] = lead;
      return acc;
    }, {} as Record<string, Lead>);
  }, [leads]);

  // Navigation handlers
  const handleNavigate = useCallback((direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date());
      announce("Navigated to today");
      return;
    }

    setCurrentDate(prev => {
      let newDate: Date;
      if (direction === "prev") {
        switch (viewMode) {
          case "day": newDate = subDays(prev, 1); break;
          case "week": newDate = subWeeks(prev, 1); break;
          case "month": newDate = subMonths(prev, 1); break;
        }
      } else {
        switch (viewMode) {
          case "day": newDate = addDays(prev, 1); break;
          case "week": newDate = addWeeks(prev, 1); break;
          case "month": newDate = addMonths(prev, 1); break;
        }
      }
      
      announce(`Navigated to ${direction === "prev" ? "previous" : "next"} ${viewMode}`);
      return newDate;
    });
  }, [viewMode, announce]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    announce(`Switched to ${mode} view`);
  }, [announce]);

  const handleSessionClick = useCallback((session: Session) => {
    setSelectedSession(session);
  }, []);

  const handleActivityClick = useCallback((activity: Activity) => {
    if (activity.project_id) {
      const project = projectsMap[activity.project_id];
      if (project) {
        setSelectedProject(project);
      }
    } else {
      navigate(`/leads/${activity.lead_id}`);
    }
  }, [projectsMap, navigate]);

  const refreshCalendar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["calendar-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-activities"] });
    announce("Calendar refreshed");
  }, [queryClient, announce]);

  const isLoading = sessionsLoading || activitiesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
      <PageHeader title="Calendar" />
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" />
      
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onNavigate={handleNavigate}
        showSessions={showSessions}
        showReminders={showReminders}
        onToggleSessions={() => setShowSessions(prev => !prev)}
        onToggleReminders={() => setShowReminders(prev => !prev)}
      />

      <div className="calendar-content">
        {viewMode === "day" && (
          <CalendarDayView
            currentDate={currentDate}
            sessions={sessions}
            activities={activities}
            showSessions={showSessions}
            showReminders={showReminders}
            leadsMap={leadsMap}
            projectsMap={projectsMap}
            onSessionClick={handleSessionClick}
            onActivityClick={handleActivityClick}
          />
        )}
        
        {/* Week and Month views would be implemented similarly */}
        {(viewMode === "week" || viewMode === "month") && (
          <div className="flex items-center justify-center h-64 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">
              {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} view coming soon
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedProject && (
        <ViewProjectDialog
          project={{
            id: selectedProject.id,
            name: selectedProject.name,
            description: "",
            lead_id: "",
            user_id: "",
            created_at: "",
            updated_at: ""
          }}
          open={!!selectedProject}
          onOpenChange={(open) => !open && setSelectedProject(null)}
        />
      )}

      {selectedSession && (
        <SessionSheetView
          sessionId={selectedSession.id}
          isOpen={!!selectedSession}
          onOpenChange={(open) => !open && setSelectedSession(null)}
          onViewFullDetails={() => navigate(`/sessions/${selectedSession.id}`)}
          onSessionUpdated={refreshCalendar}
        />
      )}
    </div>
  );
});

OptimizedCalendar.displayName = "OptimizedCalendar";

export default OptimizedCalendar;