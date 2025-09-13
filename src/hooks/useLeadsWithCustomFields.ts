import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserOrganizationId } from '@/lib/organizationUtils';
import { useToast } from '@/hooks/use-toast';

interface LeadWithCustomFields {
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

export function useLeadsWithCustomFields() {
  const [leads, setLeads] = useState<LeadWithCustomFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLeadsWithCustomFields = async () => {
    try {
      setLoading(true);
      setError(null);

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error('No active organization found');
      }

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
      const leadsWithFields: LeadWithCustomFields[] = (leadsData || []).map(lead => ({
        ...lead,
        assignees: [], // Single photographer mode - no assignees needed
        custom_fields: fieldValuesByLead[lead.id] || {},
      }));

      setLeads(leadsWithFields);
    } catch (err) {
      console.error('Error fetching leads with custom fields:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch leads';
      setError(errorMessage);
      toast({
        title: "Error fetching leads",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadsWithCustomFields();
  }, []);

  return {
    leads,
    loading,
    error,
    refetch: fetchLeadsWithCustomFields
  };
}