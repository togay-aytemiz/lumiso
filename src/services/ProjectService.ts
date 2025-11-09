import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { BaseEntityService } from './BaseEntityService';
import { logAuditEvent } from '@/lib/auditLog';
import type { Json } from "@/integrations/supabase/types";
import { syncProjectOutstandingPayment } from "@/lib/payments/outstanding";

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
}

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type TodoRow = Database["public"]["Tables"]["todos"]["Row"];
type ProjectServiceRow = Database["public"]["Tables"]["project_services"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ProjectStatusRow = Database["public"]["Tables"]["project_statuses"]["Row"];
type ProjectTypeRow = Database["public"]["Tables"]["project_types"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

type SessionSummary = Pick<SessionRow, "project_id" | "status">;
type TodoSummary = Pick<TodoRow, "project_id" | "is_completed">;
type ProjectServiceSummary = ProjectServiceRow & {
  service: Pick<ServiceRow, "id" | "name"> | null;
};
type PaymentSummary = Pick<PaymentRow, "project_id" | "amount" | "status">;
type LeadSummary = Pick<LeadRow, "id" | "name" | "status" | "email" | "phone">;
type ProjectStatusSummary = Pick<ProjectStatusRow, "id" | "name" | "color" | "sort_order">;
type ProjectTypeSummary = Pick<ProjectTypeRow, "id" | "name">;

type ProjectWithRelationsRow = ProjectRow & {
  lead: LeadSummary | LeadSummary[] | null;
  project_status: ProjectStatusSummary | ProjectStatusSummary[] | null;
  project_type: ProjectTypeSummary | ProjectTypeSummary[] | null;
  previous_status_id?: string | null;
};

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
      .from<ProjectRow>('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const projectRows = projectsData ?? [];

    if (projectRows.length === 0) {
      return { active: [], archived: [] };
    }

    // Fetch all related data separately
    const projectIds = projectRows.map((project) => project.id);
    const leadIds = Array.from(
      new Set(
        projectRows
          .map((project) => project.lead_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const [
      sessionsData,
      todosData,
      servicesData,
      paymentsData,
      leadsData,
      projectStatusesData,
      projectTypesData,
    ] = await Promise.all([
      this.fetchSessionSummaries(projectIds),
      this.fetchTodoSummaries(projectIds),
      this.fetchProjectServices(projectIds),
      this.fetchProjectPayments(projectIds),
      this.fetchLeadsByIds(leadIds),
      this.fetchProjectStatuses(organizationId),
      this.fetchProjectTypes(organizationId),
    ]);

    // Process the data to handle archived projects
    const archivedStatus = projectStatusesData.find(
      (status) => status.name.toLowerCase() === 'archived'
    );
    const archivedStatusId = archivedStatus?.id;
    
    const activeProjects = projectRows.filter(
      (project) => project.status_id !== archivedStatusId
    );
    const archivedProjects = projectRows.filter(
      (project) => project.status_id === archivedStatusId
    );

    // Create lookup maps for efficient data merging
    const sessionCounts = this.createSessionCountsMap(sessionsData);
    const todoCounts = this.createTodoCountsMap(todosData);
    const projectServices = this.createProjectServicesMap(servicesData);
    const paymentTotals = this.createPaymentTotalsMap(paymentsData);

    const leadsMap = this.createLeadsMap(leadsData);
    const statusesMap = this.createStatusesMap(projectStatusesData);
    const typesMap = this.createTypesMap(projectTypesData);

    // Merge all data
    const mapProjectData = (project: ProjectRow): ProjectWithDetails => {
      const paymentAggregate = paymentTotals[project.id] ?? { total: 0, paid: 0 };
      const basePrice = Number(project.base_price ?? 0);

      return {
        ...project,
        lead: leadsMap[project.lead_id ?? ""] ?? null,
        project_status: statusesMap[project.status_id ?? ""] ?? null,
        project_type: typesMap[project.project_type_id ?? ""] ?? null,
        session_count: sessionCounts[project.id]?.total ?? 0,
        upcoming_session_count: sessionCounts[project.id]?.upcoming ?? 0,
        planned_session_count: sessionCounts[project.id]?.planned ?? 0,
        todo_count: todoCounts[project.id]?.total ?? 0,
        completed_todo_count: todoCounts[project.id]?.completed ?? 0,
        total_payment_amount: paymentAggregate.total,
        paid_amount: paymentAggregate.paid,
        remaining_amount: basePrice - paymentAggregate.paid,
        services: projectServices[project.id] ?? [],
      };
    };

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
        let aValue: string | number | undefined;
        let bValue: string | number | undefined;

        switch (sort.field) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'lead_name':
            aValue = a.lead?.name ?? '';
            bValue = b.lead?.name ?? '';
            break;
          case 'project_type':
            aValue = a.project_type?.name ?? '';
            bValue = b.project_type?.name ?? '';
            break;
          case 'status':
            aValue = a.project_status?.name ?? '';
            bValue = b.project_status?.name ?? '';
            break;
          case 'created_at':
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case 'updated_at':
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
          return 0;
        }

        const aString = (aValue ?? '').toString().toLowerCase();
        const bString = (bValue ?? '').toString().toLowerCase();

        if (aString < bString) return sort.direction === 'asc' ? -1 : 1;
        if (aString > bString) return sort.direction === 'asc' ? 1 : -1;
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
      .from<ProjectRow>('projects')
      .insert({
        ...data,
        organization_id: organizationId,
        user_id: user.id,
      })
      .select()
      .single();

    if (error || !projectData) throw new Error('Failed to create project');
    await syncProjectOutstandingPayment({
      projectId: projectData.id,
      organizationId,
      userId: user.id,
      description: `Outstanding balance — ${data.name}`,
    });

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
    let previousRow: ProjectRow | null = null;
    try {
      const { data: currentRow } = await supabase
        .from<ProjectRow>("projects")
        .select("*")
        .eq("id", id)
        .single();
      previousRow = currentRow ?? null;
    } catch (error) {
      console.warn("Unable to fetch previous project state for audit log:", error);
    }

    const { data: result, error } = await supabase
      .from<ProjectRow>('projects')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !result) return null;
    if (previousRow) {
      void logAuditEvent({
        entityType: "project",
        entityId: id,
        action: "updated",
        oldValues: previousRow as unknown as Json,
        newValues: result as unknown as Json,
      });
    }

    if (typeof data.base_price === "number") {
      await syncProjectOutstandingPayment({
        projectId: id,
        organizationId: result.organization_id,
        userId: result.user_id,
        description: `Outstanding balance — ${result.name}`,
      });
    }

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
  private async fetchSessionSummaries(projectIds: string[]): Promise<SessionSummary[]> {
    if (projectIds.length === 0) return [];
    const { data, error } = await supabase
      .from<SessionRow>('sessions')
      .select('project_id, status')
      .in('project_id', projectIds);

    if (error || !data) {
      return [];
    }
    return data.map(({ project_id, status }) => ({ project_id, status }));
  }

  private async fetchTodoSummaries(projectIds: string[]): Promise<TodoSummary[]> {
    if (projectIds.length === 0) return [];
    const { data, error } = await supabase
      .from<TodoRow>('todos')
      .select('project_id, is_completed')
      .in('project_id', projectIds);

    if (error || !data) {
      return [];
    }
    return data.map(({ project_id, is_completed }) => ({ project_id, is_completed }));
  }

  private async fetchProjectServices(projectIds: string[]): Promise<ProjectServiceSummary[]> {
    if (projectIds.length === 0) return [];
    const { data, error } = await supabase
      .from<ProjectServiceRow>('project_services')
      .select('project_id, service:services(id, name)')
      .in('project_id', projectIds);

    if (error || !data) {
      return [];
    }

    return data.map((row) => {
      const serviceValue = Array.isArray(row.service) ? row.service[0] : row.service;
      return {
        project_id: row.project_id,
        service: serviceValue ? { id: serviceValue.id, name: serviceValue.name } : null,
      };
    });
  }

  private async fetchProjectPayments(projectIds: string[]): Promise<PaymentSummary[]> {
    if (projectIds.length === 0) return [];
    const { data, error } = await supabase
      .from<PaymentRow>('payments')
      .select('project_id, amount, status')
      .in('project_id', projectIds)
      .eq('entry_kind', 'recorded');

    if (error || !data) {
      return [];
    }

    return data.map(({ project_id, amount, status }) => ({
      project_id,
      amount,
      status,
    }));
  }

  private async fetchLeadsByIds(leadIds: string[]): Promise<LeadSummary[]> {
    if (leadIds.length === 0) return [];
    const { data, error } = await supabase
      .from<LeadRow>('leads')
      .select('id, name, status, email, phone')
      .in('id', leadIds);

    if (error || !data) {
      return [];
    }
    return data.map(({ id, name, status, email, phone }) => ({ id, name, status, email, phone }));
  }

  private async fetchProjectStatuses(organizationId: string): Promise<ProjectStatusSummary[]> {
    const { data, error } = await supabase
      .from<ProjectStatusRow>('project_statuses')
      .select('id, name, color, sort_order')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(({ id, name, color, sort_order }) => ({ id, name, color, sort_order }));
  }

  private async fetchProjectTypes(organizationId: string): Promise<ProjectTypeSummary[]> {
    const { data, error } = await supabase
      .from<ProjectTypeRow>('project_types')
      .select('id, name')
      .eq('organization_id', organizationId);

    if (error || !data) {
      return [];
    }
    return data.map(({ id, name }) => ({ id, name }));
  }

  private createSessionCountsMap(sessions: SessionSummary[]): Record<string, { total: number; upcoming: number; planned: number }> {
    return sessions.reduce<Record<string, { total: number; upcoming: number; planned: number }>>((acc, session) => {
      const bucket = acc[session.project_id] ?? { total: 0, upcoming: 0, planned: 0 };
      bucket.total += 1;
      if (session.status === 'upcoming') bucket.upcoming += 1;
      if (session.status === 'planned') bucket.planned += 1;
      acc[session.project_id] = bucket;
      return acc;
    }, {});
  }

  private createTodoCountsMap(todos: TodoSummary[]): Record<string, { total: number; completed: number }> {
    return todos.reduce<Record<string, { total: number; completed: number }>>((acc, todo) => {
      const bucket = acc[todo.project_id] ?? { total: 0, completed: 0 };
      bucket.total += 1;
      if (todo.is_completed) bucket.completed += 1;
      acc[todo.project_id] = bucket;
      return acc;
    }, {});
  }

  private createProjectServicesMap(services: ProjectServiceSummary[]): Record<string, Array<{ id: string; name: string }>> {
    return services.reduce<Record<string, Array<{ id: string; name: string }>>>((acc, projectService) => {
      if (!acc[projectService.project_id]) {
        acc[projectService.project_id] = [];
      }
      if (projectService.service) {
        acc[projectService.project_id].push(projectService.service);
      }
      return acc;
    }, {});
  }

  private createPaymentTotalsMap(payments: PaymentSummary[]): Record<string, { total: number; paid: number }> {
    return payments.reduce<Record<string, { total: number; paid: number }>>((acc, payment) => {
      const bucket = acc[payment.project_id] ?? { total: 0, paid: 0 };
      const amount = Number(payment.amount ?? 0);
      bucket.total += amount;
      if (payment.status === 'paid') {
        bucket.paid += amount;
      }
      acc[payment.project_id] = bucket;
      return acc;
    }, {});
  }

  private createLeadsMap(leads: LeadSummary[]): Record<string, LeadSummary> {
    return leads.reduce<Record<string, LeadSummary>>((acc, lead) => {
      acc[lead.id] = lead;
      return acc;
    }, {});
  }

  private createStatusesMap(statuses: ProjectStatusSummary[]): Record<string, ProjectStatusSummary> {
    return statuses.reduce<Record<string, ProjectStatusSummary>>((acc, status) => {
      acc[status.id] = status;
      return acc;
    }, {});
  }

  private createTypesMap(types: ProjectTypeSummary[]): Record<string, ProjectTypeSummary> {
    return types.reduce<Record<string, ProjectTypeSummary>>((acc, type) => {
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
    const { active, archived } = await this.fetchProjects(true);
    const project = [...active, ...archived].find((item) => item.id === id);
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  /**
   * Fetch lead by ID
   */
  async fetchLeadById(id: string): Promise<LeadRow | null> {
    const { data, error } = await supabase
      .from<LeadRow>('leads')
      .select('id, name, email, phone, status, notes')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  /**
   * Fetch project type by ID
   */
  async fetchProjectTypeById(id: string): Promise<ProjectTypeSummary | null> {
    const { data, error } = await supabase
      .from<ProjectTypeRow>('project_types')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? { id: data.id, name: data.name } : null;
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
      .from<ProjectStatusRow>('project_statuses')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', 'archived')
      .maybeSingle();

    if (archivedStatusError) throw archivedStatusError;
    if (!archivedStatus?.id) throw new Error('Archived status not found');

    if (currentlyArchived) {
      // Restore: get previous status from project
      const { data: project } = await supabase
        .from<ProjectRow>('projects')
        .select('previous_status_id')
        .eq('id', projectId)
        .maybeSingle();

      const { error } = await supabase
        .from<ProjectRow>('projects')
        .update({ 
          status_id: project?.previous_status_id ?? null,
          previous_status_id: null
        })
        .eq('id', projectId);

      if (error) throw error;
    } else {
      // Archive: save current status as previous
      const { data: project } = await supabase
        .from<ProjectRow>('projects')
        .select('status_id')
        .eq('id', projectId)
        .maybeSingle();

      const { error } = await supabase
        .from<ProjectRow>('projects')
        .update({ 
          status_id: archivedStatus.id,
          previous_status_id: project?.status_id ?? null
        })
        .eq('id', projectId);

      if (error) throw error;
    }
  }
}
