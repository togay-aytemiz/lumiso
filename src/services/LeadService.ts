import { supabase } from '@/integrations/supabase/client';
import { BaseEntityService } from './BaseEntityService';

export interface LeadWithCustomFields {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  status_id: string;
  assignees: string[];
  updated_at: string;
  created_at: string;
  due_date?: string;
  notes?: string;
  custom_fields: Record<string, string | null>;
  lead_statuses?: {
    id: string;
    name: string;
    color: string;
    is_system_final: boolean;
  };
}

export interface CreateLeadData {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  status_id?: string;
  due_date?: string;
  custom_fields?: Record<string, string | null>;
}

export interface UpdateLeadData {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status_id?: string;
  due_date?: string;
}

export interface LeadFilters {
  status?: string;
  statusId?: string;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface LeadSort {
  field: 'name' | 'email' | 'phone' | 'status' | 'due_date' | 'created_at' | 'updated_at';
  direction: 'asc' | 'desc';
}

/**
 * Service for lead-related operations
 */
export class LeadService extends BaseEntityService {
  constructor() {
    super();
  }

  /**
   * Fetch leads with custom fields and status information
   */
  async fetchLeadsWithCustomFields(): Promise<LeadWithCustomFields[]> {
    const organizationId = await this.getOrganizationId();
    if (!organizationId) return [];

    // Fetch leads with status information
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select(`
        *,
        lead_statuses(id, name, color, is_system_final)
      `)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false });

    if (leadsError) throw leadsError;

    // Fetch all custom field values for these leads
    const leadIds = leadsData?.map(lead => lead.id) || [];
    if (leadIds.length === 0) return [];

    const { data: fieldValues, error: fieldValuesError } = await supabase
      .from('lead_field_values')
      .select('lead_id, field_key, value')
      .in('lead_id', leadIds);

    if (fieldValuesError) throw fieldValuesError;

    // Group field values by lead_id
    const fieldValuesByLead = (fieldValues || []).reduce((acc, fv) => {
      if (!acc[fv.lead_id]) {
        acc[fv.lead_id] = {};
      }
      acc[fv.lead_id][fv.field_key] = fv.value;
      return acc;
    }, {} as Record<string, Record<string, string | null>>);

    // Combine leads with their custom field values
    return (leadsData || []).map(lead => ({
      ...lead,
      assignees: [], // Single photographer mode - no assignees needed
      custom_fields: fieldValuesByLead[lead.id] || {},
    }));
  }

  /**
   * Fetch filtered and sorted leads
   */
  async fetchLeads(filters?: LeadFilters, sort?: LeadSort): Promise<LeadWithCustomFields[]> {
    let leads = await this.fetchLeadsWithCustomFields();

    // Apply filters
    if (filters) {
      if (filters.status && filters.status !== 'all') {
        leads = leads.filter(lead => lead.lead_statuses?.name === filters.status);
      }
      if (filters.statusId) {
        leads = leads.filter(lead => lead.status_id === filters.statusId);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        leads = leads.filter(lead => 
          lead.name.toLowerCase().includes(searchLower) ||
          lead.email?.toLowerCase().includes(searchLower) ||
          lead.phone?.toLowerCase().includes(searchLower) ||
          lead.notes?.toLowerCase().includes(searchLower)
        );
      }
      if (filters.dueDateFrom) {
        leads = leads.filter(lead => 
          lead.due_date && lead.due_date >= filters.dueDateFrom!
        );
      }
      if (filters.dueDateTo) {
        leads = leads.filter(lead => 
          lead.due_date && lead.due_date <= filters.dueDateTo!
        );
      }
    }

    // Apply sorting
    if (sort) {
      leads.sort((a, b) => {
        let aValue: any = a[sort.field];
        let bValue: any = b[sort.field];

        // Handle special cases
        if (sort.field === 'status') {
          aValue = a.lead_statuses?.name || '';
          bValue = b.lead_statuses?.name || '';
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sort.field === 'created_at' || sort.field === 'updated_at' || sort.field === 'due_date') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        }

        if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return leads;
  }

  /**
   * Create a new lead
   */
  async createLead(data: CreateLeadData): Promise<LeadWithCustomFields> {
    const organizationId = await this.getOrganizationId();
    if (!organizationId) throw new Error('No organization ID found');

    const user = await this.getAuthenticatedUser();

    // Create the lead first
    const { data: leadData, error } = await supabase
      .from('leads')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        status_id: data.status_id,
        due_date: data.due_date,
        organization_id: organizationId,
        user_id: user.id,
      })
      .select()
      .single();

    if (error || !leadData) throw new Error('Failed to create lead');

    // Handle custom fields if provided
    if (data.custom_fields) {
      const fieldValues = Object.entries(data.custom_fields)
        .filter(([_, value]) => value !== null && value !== undefined && value !== '')
        .map(([field_key, value]) => ({
          lead_id: leadData.id,
          field_key,
          value,
        }));

      if (fieldValues.length > 0) {
        const { error } = await supabase
          .from('lead_field_values')
          .insert(fieldValues);

        if (error) throw error;
      }
    }

    // Return the created lead with custom fields
    const leads = await this.fetchLeadsWithCustomFields();
    const createdLead = leads.find(lead => lead.id === leadData.id);
    if (!createdLead) throw new Error('Failed to fetch created lead');
    return createdLead;
  }

  /**
   * Update an existing lead
   */
  async updateLead(id: string, data: UpdateLeadData): Promise<LeadWithCustomFields | null> {
    const { data: result, error } = await supabase
      .from('leads')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !result) return null;

    // Fetch and return updated lead with custom fields
    const leads = await this.fetchLeadsWithCustomFields();
    return leads.find(lead => lead.id === id) || null;
  }

  /**
   * Delete a lead
   */
  async deleteLead(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /**
   * Update custom field value for a lead
   */
  async updateCustomField(leadId: string, fieldKey: string, value: string | null): Promise<void> {
    const { error } = await supabase
      .from('lead_field_values')
      .upsert(
        { lead_id: leadId, field_key: fieldKey, value },
        { onConflict: 'lead_id,field_key' }
      );

    if (error) throw error;
  }
}