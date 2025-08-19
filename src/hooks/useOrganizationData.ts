import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Hook for fetching organization-specific data with automatic cache invalidation
export function useOrganizationData<T>(
  queryKey: string[],
  queryFn: (organizationId: string) => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number; // renamed from cacheTime in TanStack Query v5
  }
) {
  const { activeOrganizationId, loading: orgLoading } = useOrganization();

  return useQuery({
    queryKey: [...queryKey, activeOrganizationId],
    queryFn: () => {
      if (!activeOrganizationId) {
        throw new Error('No active organization');
      }
      return queryFn(activeOrganizationId);
    },
    enabled: !orgLoading && !!activeOrganizationId && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: options?.gcTime ?? 10 * 60 * 1000, // 10 minutes
  });
}

// Optimized hooks for common organization-based queries
export function useProjectTypes() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['project_types', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];
      
      const { data, error } = await supabase
        .from('project_types')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLeadStatuses() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['lead_statuses', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];
      
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useServices() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['services', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePackages() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['packages', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];
      
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}