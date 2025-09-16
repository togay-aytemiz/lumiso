import { supabase } from '@/integrations/supabase/client';
import { BaseEntityService } from './BaseEntityService';

export interface Session {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  created_at: string;
  project_id?: string | null;
  session_name?: string | null;
  location?: string | null;
  google_event_id?: string | null;
  organization_id: string;
  user_id: string;
  project_name?: string;
  lead_name?: string;
  lead_status?: string;
  lead?: {
    id: string;
    name: string;
    status: string;
    email?: string;
    phone?: string;
  };
  project?: {
    id: string;
    name: string;
    status_id?: string;
  };
}

export interface CreateSessionData {
  lead_id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  status?: string;
  project_id?: string;
  session_name?: string;
  location?: string;
}

export interface UpdateSessionData {
  session_date?: string;
  session_time?: string;
  notes?: string;
  status?: string;
  project_id?: string;
  session_name?: string;
  location?: string;
}

export interface SessionFilters {
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  leadId?: string;
  projectId?: string;
  search?: string;
}

export interface SessionSort {
  field: 'session_date' | 'session_time' | 'status' | 'lead_name' | 'created_at';
  direction: 'asc' | 'desc';
}

/**
 * Service for session-related operations
 */
export class SessionService extends BaseEntityService {
  constructor() {
    super();
  }

  /**
   * Fetch sessions with all related data
   */
  async fetchSessions(): Promise<Session[]> {
    const organizationId = await this.getOrganizationId();
    if (!organizationId) return [];

    // Get sessions with proper validation using inner joins
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        *,
        leads!inner(id, name, status, email, phone),
        projects(id, name, status_id)
      `)
      .eq('organization_id', organizationId)
      .order('session_date', { ascending: false })
      .order('session_time', { ascending: false });

    if (sessionsError) throw sessionsError;

    // Filter out sessions with invalid references or archived projects
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    let filteredSessions = sessionsData || [];
    
    if (userId && organizationId) {
      // Get archived status for filtering
      const { data: archivedStatus } = await supabase
        .from('project_statuses')
        .select('id, name')
        .eq('organization_id', organizationId)
        .ilike('name', 'archived')
        .maybeSingle();
        
      filteredSessions = filteredSessions.filter(session => {
        // Must have valid lead (inner join ensures this)
        if (!session.leads) return false;
        
        // If session has a project, check if it's archived
        if (session.project_id && session.projects) {
          if (archivedStatus?.id && session.projects.status_id === archivedStatus.id) {
            return false;
          }
        }
        
        return true;
      });
    }

    // Process sessions with enhanced data validation
    return filteredSessions.map(session => ({
      ...session,
      lead_name: session.leads?.name || 'Unknown Lead',
      lead_status: session.leads?.status || 'unknown',
      project_name: session.projects?.name || undefined,
      lead: session.leads,
      project: session.projects
    }));
  }

  /**
   * Fetch filtered and sorted sessions
   */
  async fetchFilteredSessions(
    filters?: SessionFilters,
    sort?: SessionSort
  ): Promise<Session[]> {
    let sessions = await this.fetchSessions();

    // Apply filters
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        sessions = sessions.filter(session => session.status === filters.status);
      }
      
      if (filters.dateRange) {
        sessions = sessions.filter(session => {
          const sessionDate = new Date(session.session_date);
          return sessionDate >= filters.dateRange!.start && 
                 sessionDate < filters.dateRange!.end;
        });
      }
      
      if (filters.leadId) {
        sessions = sessions.filter(session => session.lead_id === filters.leadId);
      }
      
      if (filters.projectId) {
        sessions = sessions.filter(session => session.project_id === filters.projectId);
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        sessions = sessions.filter(session => 
          session.lead_name?.toLowerCase().includes(searchLower) ||
          session.project_name?.toLowerCase().includes(searchLower) ||
          session.notes?.toLowerCase().includes(searchLower) ||
          session.location?.toLowerCase().includes(searchLower) ||
          session.session_name?.toLowerCase().includes(searchLower)
        );
      }
    }

    // Apply sorting
    if (sort) {
      sessions.sort((a, b) => {
        // For date sorting, always add secondary sort by time
        if (sort.field === 'session_date') {
          const aDate = a.session_date ? new Date(a.session_date).getTime() : 0;
          const bDate = b.session_date ? new Date(b.session_date).getTime() : 0;
          
          // First compare dates
          if (aDate !== bDate) {
            return sort.direction === 'asc' ? aDate - bDate : bDate - aDate;
          }
          
          // If dates are equal, sort by time (always ascending for better UX)
          const aTime = a.session_time || '';
          const bTime = b.session_time || '';
          return aTime.localeCompare(bTime);
        }
        
        // For other fields, use regular sorting
        let aValue: any = a[sort.field];
        let bValue: any = b[sort.field];

        // Handle date values
        if (sort.field === 'created_at') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        }

        // Handle time values
        if (sort.field === 'session_time') {
          aValue = aValue ? aValue : '';
          bValue = bValue ? bValue : '';
        }

        // Handle string values
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return sessions;
  }

  /**
   * Create a new session
   */
  async createSession(data: CreateSessionData): Promise<Session> {
    const organizationId = await this.getOrganizationId();
    if (!organizationId) throw new Error('No organization ID found');

    const user = await this.getAuthenticatedUser();

    const { data: sessionData, error } = await supabase
      .from('sessions')
      .insert({
        ...data,
        organization_id: organizationId,
        user_id: user.id,
      })
      .select()
      .single();

    if (error || !sessionData) throw new Error('Failed to create session');

    // Fetch and return the created session with all related data
    const sessions = await this.fetchSessions();
    const createdSession = sessions.find(s => s.id === sessionData.id);
    if (!createdSession) throw new Error('Failed to fetch created session');
    
    return createdSession;
  }

  /**
   * Update an existing session
   */
  async updateSession(id: string, data: UpdateSessionData): Promise<Session | null> {
    const { data: result, error } = await supabase
      .from('sessions')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !result) return null;

    // Fetch and return updated session with all related data
    const sessions = await this.fetchSessions();
    return sessions.find(session => session.id === id) || null;
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /**
   * Get sessions by date range
   */
  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<Session[]> {
    return this.fetchFilteredSessions({
      dateRange: { start: startDate, end: endDate }
    });
  }

  /**
   * Get upcoming sessions
   */
  async getUpcomingSessions(daysAhead: number = 30): Promise<Session[]> {
    const today = new Date();
    const futureDate = new Date(today.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
    
    return this.fetchFilteredSessions({
      dateRange: { start: today, end: futureDate }
    }, {
      field: 'session_date',
      direction: 'asc'
    });
  }

  /**
   * Get sessions for a specific lead
   */
  async getSessionsForLead(leadId: string): Promise<Session[]> {
    return this.fetchFilteredSessions({ leadId });
  }

  /**
   * Get sessions for a specific project
   */
  async getSessionsForProject(projectId: string): Promise<Session[]> {
    return this.fetchFilteredSessions({ projectId });
  }
}