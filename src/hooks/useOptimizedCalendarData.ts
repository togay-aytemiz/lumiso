import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { addMonths, format, startOfMonth, endOfMonth } from "date-fns";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  notes?: string;
  lead_id: string;
  project_id?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  leads?: { id: string; name: string };
  projects?: { id: string; name: string; status_id?: string };
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
  lead_id: string;
  package_id?: string | null;
  package_snapshot?: unknown;
}

interface Lead {
  id: string;
  name: string;
}

/**
 * Optimized calendar data hook that consolidates queries and applies date-range filtering
 */
export function useOptimizedCalendarData(currentDate: Date, viewMode: 'day' | 'week' | 'month') {
  // Calculate date range based on view mode with buffer for smooth navigation
  const dateRange = useMemo(() => {
    const buffer = viewMode === 'month' ? 1 : 0; // 1 month buffer for month view
    const start = format(addMonths(startOfMonth(currentDate), -buffer), 'yyyy-MM-dd');
    const end = format(addMonths(endOfMonth(currentDate), buffer), 'yyyy-MM-dd');
    return { start, end };
  }, [currentDate, viewMode]);

  // Single consolidated query for sessions with date filtering and joins
  const { data: sessionsData, error: sessionsError, isLoading: sessionsLoading } = useQuery({
    queryKey: ["optimized-sessions", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { sessions: [], organizationId: null };

      // Get organization ID once
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return { sessions: [], organizationId: null };

      // Get archived status ID in parallel with sessions query
      const [sessionsResult, archivedStatusResult] = await Promise.all([
        supabase
          .from("sessions")
          .select(`
            id,
            session_date,
            session_time,
            status,
            notes,
            lead_id,
            project_id,
            location,
            leads!inner(id, name),
            projects(id, name, status_id),
            session_types:session_type_id(duration_minutes)
          `)
          .eq('organization_id', organizationId)
          .gte('session_date', dateRange.start)
          .lte('session_date', dateRange.end)
          .order("session_date", { ascending: true }),
        
        supabase
          .from('project_statuses')
          .select('id, name')
          .eq('organization_id', organizationId)
          .ilike('name', 'archived')
          .maybeSingle()
      ]);

      if (sessionsResult.error) throw sessionsResult.error;
      
      const archivedStatusId = archivedStatusResult.data?.id;
      
      // Filter out archived projects on client (minimal filtering since we pre-filtered by date)
      const filteredSessions = (sessionsResult.data || []).filter(session => {
        if (!session.leads) return false;
        if (session.project_id && session.projects && archivedStatusId && 
            session.projects.status_id === archivedStatusId) {
          return false;
        }
        return true;
      });

      const normalizedSessions: Session[] = (
        filteredSessions as Array<
          Session & { session_types?: { duration_minutes?: number | null } | null }
        >
      ).map(session => {
        const { session_types, ...rest } = session as Session & {
          session_types?: { duration_minutes?: number | null } | null;
        };
        return {
          ...rest,
          duration_minutes: session_types?.duration_minutes ?? rest.duration_minutes ?? null,
        };
      });

      return {
        sessions: normalizedSessions,
        organizationId,
        archivedStatusId
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Optimized activities query with date filtering and archived project filtering
  const { data: activitiesData, error: activitiesError, isLoading: activitiesLoading } = useQuery({
    queryKey: ["optimized-activities", dateRange.start, dateRange.end, sessionsData?.organizationId, sessionsData?.archivedStatusId],
    queryFn: async () => {
      const organizationId = sessionsData?.organizationId;
      const archivedStatusId = sessionsData?.archivedStatusId;
      
      if (!organizationId) return [];

      // Query activities with date range filtering
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq('organization_id', organizationId)
        .gte('reminder_date', dateRange.start)
        .lte('reminder_date', dateRange.end)
        .order("reminder_date", { ascending: true });
      
      if (error) throw error;
      
      // If we have archived status, get archived project IDs for filtering
      let archivedProjectIds: string[] = [];
      if (archivedStatusId) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('status_id', archivedStatusId);
        
        archivedProjectIds = projects?.map(p => p.id) || [];
      }

      // Filter activities (minimal since we pre-filtered by date)
      const filteredActivities = (data || []).filter(activity => {
        if (!activity.reminder_date) return false;
        if (activity.project_id && archivedProjectIds.includes(activity.project_id)) {
          return false;
        }
        return true;
      });

      return filteredActivities as Activity[];
    },
    enabled: !!sessionsData?.organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Lightweight query for projects and leads (no date filtering needed)
  const { data: referenceData, error: referenceError, isLoading: referenceLoading } = useQuery({
    queryKey: ["calendar-reference-data", sessionsData?.organizationId],
    queryFn: async () => {
      const organizationId = sessionsData?.organizationId;
      if (!organizationId) return { projects: [], leads: [] };

      // Parallel fetch of projects and leads
      const [projectsResult, leadsResult] = await Promise.all([
        supabase
          .from("projects")
          .select("id,name,lead_id,package_id,package_snapshot")
          .eq('organization_id', organizationId),
        
        supabase
          .from("leads")
          .select("id,name")
          .eq('organization_id', organizationId)
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (leadsResult.error) throw leadsResult.error;

      return {
        projects: (projectsResult.data || []) as Project[],
        leads: (leadsResult.data || []) as Lead[]
      };
    },
    enabled: !!sessionsData?.organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes - reference data changes less frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Memoized lookup maps for performance
  const lookupMaps = useMemo(() => {
    const projects = referenceData?.projects || [];
    const leads = referenceData?.leads || [];
    
    return {
      projectsMap: Object.fromEntries(projects.map(p => [p.id, p])),
      leadsMap: Object.fromEntries(leads.map(l => [l.id, l]))
    };
  }, [referenceData]);

  // Combine all loading and error states
  const isLoading = sessionsLoading || activitiesLoading || referenceLoading;
  const error = sessionsError || activitiesError || referenceError;

  return {
    sessions: sessionsData?.sessions || [],
    activities: activitiesData || [],
    projects: referenceData?.projects || [],
    leads: referenceData?.leads || [],
    projectsMap: lookupMaps.projectsMap,
    leadsMap: lookupMaps.leadsMap,
    isLoading,
    error,
    organizationId: sessionsData?.organizationId
  };
}
