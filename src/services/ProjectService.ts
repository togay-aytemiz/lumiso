import { supabase } from '@/integrations/supabase/client';
import { BaseEntityService } from './BaseEntityService';

export interface ProjectWithDetails {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
  project_type_id?: string | null;
  base_price?: number | null;
  sort_order?: number;
  organization_id: string;
  lead?: {
    id: string;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
  } | null;
  project_status?: {
    id: string;
    name: string;
    color: string;
  } | null;
  project_type?: {
    id: string;
    name: string;
  } | null;
  session_count?: number;
  upcoming_session_count?: number;
  planned_session_count?: number;
  next_session_date?: string | null;
  todo_count?: number;
  completed_todo_count?: number;
  total_payment_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  services?: Array<{
    id: string;
    name: string;
  }>;
  assignees?: string[];
}

export interface CreateProjectData {
  name: string;
  description?: string;
  lead_id: string;
  status_id?: string;
  project_type_id?: string;
  base_price?: number;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  status_id?: string;
  project_type_id?: string;
  base_price?: number;
  sort_order?: number;
}

export interface ProjectFilters {
  status?: string;
  statusId?: string;
  projectTypeId?: string;
  leadId?: string;
  search?: string;
  archived?: boolean;
}

export interface ProjectSort {
  field: 'name' | 'lead_name' | 'project_type' | 'status' | 'created_at' | 'updated_at';
  direction: 'asc' | 'desc';
}

/**
 * Service for project-related operations
 */
export class ProjectService extends BaseEntityService {
  constructor() {
    super();
  }

  /**
   * Fetch projects with all related data
   */
  async fetchProjects(includeArchived: boolean = false): Promise<{ active: ProjectWithDetails[], archived: ProjectWithDetails[] }> {
    const organizationId = await this.getOrganizationId();
    if (!organizationId) return { active: [], archived: [] };

    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!projectsData || projectsData.length === 0) {
      return { active: [], archived: [] };
    }

    // Fetch all related data separately
    const projectIds = projectsData.map(p => p.id);
    const leadIds = projectsData.map(p => p.lead_id).filter(Boolean);
    
    const [
      sessionsData,
      todosData,
      servicesData,
      paymentsData,
      leadsData,
      projectStatusesData,
      projectTypesData
    ] = await Promise.all([
      // Get session counts
      this.fetchSessionCounts(projectIds),
      // Get todo counts  
      this.fetchTodoCounts(projectIds),
      // Get services
      this.fetchProjectServices(projectIds),
      // Get payments
      this.fetchProjectPayments(projectIds),
      // Get leads
      leadIds.length > 0 ? supabase
        .from('leads')
        .select('id, name, status, email, phone')
        .in('id', leadIds) : Promise.resolve({ data: [] }),
      // Get project statuses
      supabase
        .from('project_statuses')
        .select('id, name, color, sort_order')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true }),
      // Get project types
      supabase
        .from('project_types')
        .select('id, name')
        .eq('organization_id', organizationId)
    ]);

    // Process the data to handle archived projects
    const archivedStatus = projectStatusesData.data?.find(status => 
      status.name.toLowerCase() === 'archived'
    );
    const archivedStatusId = archivedStatus?.id;
    
    const activeProjects = projectsData.filter(project => 
      project.status_id !== archivedStatusId
    );
    const archivedProjects = projectsData.filter(project => 
      project.status_id === archivedStatusId
    );

    // Create lookup maps for efficient data merging
    const sessionCounts = this.createSessionCountsMap(sessionsData);
    const todoCounts = this.createTodoCountsMap(todosData);
    const projectServices = this.createProjectServicesMap(servicesData);
    const paymentTotals = this.createPaymentTotalsMap(paymentsData);
    
    const leadsMap = this.createLeadsMap(leadsData.data || []);
    const statusesMap = this.createStatusesMap(projectStatusesData.data || []);
    const typesMap = this.createTypesMap(projectTypesData.data || []);

    // Merge all data
    const mapProjectData = (project: any): ProjectWithDetails => ({
      ...project,
      lead: leadsMap[project.lead_id] || null,
      project_status: statusesMap[project.status_id] || null,
      project_type: typesMap[project.project_type_id] || null,
      session_count: sessionCounts[project.id]?.total || 0,
      upcoming_session_count: sessionCounts[project.id]?.upcoming || 0,
      planned_session_count: sessionCounts[project.id]?.planned || 0,
      todo_count: todoCounts[project.id]?.total || 0,
      completed_todo_count: todoCounts[project.id]?.completed || 0,
      paid_amount: paymentTotals[project.id]?.paid || 0,
      remaining_amount: (Number(project.base_price || 0)) - (paymentTotals[project.id]?.paid || 0),
      services: projectServices[project.id] || []
    });

    return {
      active: activeProjects.map(mapProjectData),
      archived: archivedProjects.map(mapProjectData)
    };
  }

  /**
   * Fetch filtered and sorted projects
   */
  async fetchFilteredProjects(
    filters?: ProjectFilters,
    sort?: ProjectSort
  ): Promise<ProjectWithDetails[]> {
    const { active, archived } = await this.fetchProjects(true);
    let projects = filters?.archived ? archived : active;

    // Apply filters
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        projects = projects.filter(project => 
          project.project_status?.name === filters.status
        );
      }
      if (filters.statusId) {
        projects = projects.filter(project => project.status_id === filters.statusId);
      }
      if (filters.projectTypeId) {
        projects = projects.filter(project => 
          project.project_type_id === filters.projectTypeId
        );
      }
      if (filters.leadId) {
        projects = projects.filter(project => project.lead_id === filters.leadId);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        projects = projects.filter(project => 
          project.name.toLowerCase().includes(searchLower) ||
          project.description?.toLowerCase().includes(searchLower) ||
          project.lead?.name?.toLowerCase().includes(searchLower)
        );
      }
    }

    // Apply sorting
    if (sort) {
      projects.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sort.field) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'lead_name':
            aValue = a.lead?.name || '';
            bValue = b.lead?.name || '';
            break;
          case 'project_type':
            aValue = a.project_type?.name || '';
            bValue = b.project_type?.name || '';
            break;
          case 'status':
            aValue = a.project_status?.name || '';
            bValue = b.project_status?.name || '';
            break;
          case 'created_at':
          case 'updated_at':
            aValue = new Date(a[sort.field]).getTime();
            bValue = new Date(b[sort.field]).getTime();
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return projects;
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectData): Promise<ProjectWithDetails> {
    const organizationId = await this.getOrganizationId();
    if (!organizationId) throw new Error('No organization ID found');

    const user = await this.getAuthenticatedUser();

    const { data: projectData, error } = await supabase
      .from('projects')
      .insert({
        ...data,
        organization_id: organizationId,
        user_id: user.id,
      })
      .select()
      .single();

    if (error || !projectData) throw new Error('Failed to create project');

    // Fetch and return the created project with all related data
    const { active, archived } = await this.fetchProjects(true);
    const allProjects = [...active, ...archived];
    const createdProject = allProjects.find(p => p.id === projectData.id);
    if (!createdProject) throw new Error('Failed to fetch created project');
    
    return createdProject;
  }

  /**
   * Update an existing project
   */
  async updateProject(id: string, data: UpdateProjectData): Promise<ProjectWithDetails | null> {
    const { data: result, error } = await supabase
      .from('projects')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !result) return null;

    // Fetch and return updated project with all related data
    const { active, archived } = await this.fetchProjects(true);
    const allProjects = [...active, ...archived];
    return allProjects.find(project => project.id === id) || null;
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  // Helper methods for data processing
  private async fetchSessionCounts(projectIds: string[]) {
    if (projectIds.length === 0) return { data: [] };
    return supabase
      .from('sessions')
      .select('project_id, status')
      .in('project_id', projectIds);
  }

  private async fetchTodoCounts(projectIds: string[]) {
    if (projectIds.length === 0) return { data: [] };
    return supabase
      .from('todos')
      .select('project_id, is_completed')
      .in('project_id', projectIds);
  }

  private async fetchProjectServices(projectIds: string[]) {
    if (projectIds.length === 0) return { data: [] };
    return supabase
      .from('project_services')
      .select(`
        project_id,
        service:services(id, name)
      `)
      .in('project_id', projectIds);
  }

  private async fetchProjectPayments(projectIds: string[]) {
    if (projectIds.length === 0) return { data: [] };
    return supabase
      .from('payments')
      .select('project_id, amount, status')
      .in('project_id', projectIds);
  }

  private createSessionCountsMap(sessionsData: any) {
    return (sessionsData.data || []).reduce((acc: any, session: any) => {
      if (!acc[session.project_id]) {
        acc[session.project_id] = { total: 0, upcoming: 0, planned: 0 };
      }
      acc[session.project_id].total++;
      if (session.status === 'upcoming') acc[session.project_id].upcoming++;
      if (session.status === 'planned') acc[session.project_id].planned++;
      return acc;
    }, {});
  }

  private createTodoCountsMap(todosData: any) {
    return (todosData.data || []).reduce((acc: any, todo: any) => {
      if (!acc[todo.project_id]) {
        acc[todo.project_id] = { total: 0, completed: 0 };
      }
      acc[todo.project_id].total++;
      if (todo.is_completed) acc[todo.project_id].completed++;
      return acc;
    }, {});
  }

  private createProjectServicesMap(servicesData: any) {
    return (servicesData.data || []).reduce((acc: any, ps: any) => {
      if (!acc[ps.project_id]) acc[ps.project_id] = [];
      if (ps.service) acc[ps.project_id].push(ps.service);
      return acc;
    }, {});
  }

  private createPaymentTotalsMap(paymentsData: any) {
    return (paymentsData.data || []).reduce((acc: any, payment: any) => {
      if (!acc[payment.project_id]) {
        acc[payment.project_id] = { paid: 0 };
      }
      if (payment.status === 'paid') {
        acc[payment.project_id].paid += Number(payment.amount || 0);
      }
      return acc;
    }, {});
  }

  private createLeadsMap(leadsData: any[]) {
    return leadsData.reduce((acc: any, lead: any) => {
      acc[lead.id] = lead;
      return acc;
    }, {});
  }

  private createStatusesMap(statusesData: any[]) {
    return statusesData.reduce((acc: any, status: any) => {
      acc[status.id] = status;
      return acc;
    }, {});
  }

  private createTypesMap(typesData: any[]) {
    return typesData.reduce((acc: any, type: any) => {
      acc[type.id] = type;
      return acc;
    }, {});
  }

  /**
   * Fetch projects with all related details (alias for new components)
   */
  async fetchProjectsWithDetails(): Promise<ProjectWithDetails[]> {
    const { active, archived } = await this.fetchProjects(true);
    return [...active, ...archived];
  }

  /**
   * Fetch a single project by ID
   */
  async fetchProjectById(id: string): Promise<ProjectWithDetails> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        lead:leads(id, name, status, email, phone),
        project_status:project_statuses(id, name, color),
        project_type:project_types(id, name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw new Error('Project not found');
    
    // Transform the data to match our interface
    const transformedProject: ProjectWithDetails = {
      ...data,
      lead: Array.isArray(data.lead) ? data.lead[0] : data.lead,
      project_status: Array.isArray(data.project_status) ? data.project_status[0] : data.project_status,
      project_type: Array.isArray(data.project_type) ? data.project_type[0] : data.project_type
    };
    
    return transformedProject;
  }

  /**
   * Fetch lead by ID
   */
  async fetchLeadById(id: string): Promise<any> {
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, email, phone, status, notes')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Fetch project type by ID
   */
  async fetchProjectTypeById(id: string): Promise<any> {
    const { data, error } = await supabase
      .from('project_types')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Toggle archive status of a project
   */
  async toggleArchiveStatus(projectId: string, currentlyArchived: boolean): Promise<void> {
    // First get the archived status ID
    const organizationId = await this.getOrganizationId();
    if (!organizationId) {
      throw new Error('No organization ID found');
    }

    const { data: archivedStatus, error: archivedStatusError } = await supabase
      .from('project_statuses')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', 'archived')
      .maybeSingle();

    if (archivedStatusError) throw archivedStatusError;
    if (!archivedStatus) throw new Error('Archived status not found');

    if (currentlyArchived) {
      // Restore: get previous status from project
      const { data: project } = await supabase
        .from('projects')
        .select('previous_status_id')
        .eq('id', projectId)
        .single();

      const { error } = await supabase
        .from('projects')
        .update({ 
          status_id: project?.previous_status_id || null,
          previous_status_id: null
        })
        .eq('id', projectId);

      if (error) throw error;
    } else {
      // Archive: save current status as previous
      const { data: project } = await supabase
        .from('projects')
        .select('status_id')
        .eq('id', projectId)
        .single();

      const { error } = await supabase
        .from('projects')
        .update({ 
          status_id: archivedStatus.id,
          previous_status_id: project?.status_id
        })
        .eq('id', projectId);

      if (error) throw error;
    }
  }
}
