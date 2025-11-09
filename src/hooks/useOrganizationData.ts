import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  DEFAULT_ORGANIZATION_TAX_PROFILE,
  OrganizationTaxProfile,
  ORGANIZATION_SETTINGS_CACHE_TTL,
  fetchOrganizationSettingsWithCache,
} from '@/lib/organizationSettingsCache';

// Hook for fetching organization-specific data with automatic cache invalidation
export function useOrganizationData<T>(
  queryKey: string[],
  queryFn: (organizationId: string) => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number; // renamed from cacheTime in TanStack Query v5
    refetchInterval?: number;
    refetchOnWindowFocus?: boolean;
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
    refetchInterval: options?.refetchInterval ?? 2 * 60 * 1000,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
    refetchOnReconnect: true,
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
        .from<Database['public']['Tables']['lead_statuses']['Row']>('lead_statuses')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      // Ensure default packages exist
      await supabase.rpc('ensure_default_packages_for_org', { 
        user_uuid: user.user.id, 
        org_id: activeOrganizationId 
      });
      
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePackageDeliveryMethods() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['package_delivery_methods', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];

      const { data, error } = await supabase
        .from<Database['public']['Tables']['package_delivery_methods']['Row']>('package_delivery_methods')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('sort_order')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSessionTypes() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['session_types', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      await supabase.rpc('ensure_default_session_types_for_org', {
        user_uuid: user.user.id,
        org_id: activeOrganizationId,
      });

      const { data, error } = await supabase
        .from('session_types')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProjectStatuses() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['project_statuses', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];
      
      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: keepPreviousData,
  });
}

export function useOrganizationTaxProfile() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['organization_tax_profile', activeOrganizationId],
    queryFn: async (): Promise<OrganizationTaxProfile> => {
      if (!activeOrganizationId) {
        return { ...DEFAULT_ORGANIZATION_TAX_PROFILE };
      }

      const settings = await fetchOrganizationSettingsWithCache(activeOrganizationId);
      if (!settings) {
        return { ...DEFAULT_ORGANIZATION_TAX_PROFILE };
      }

      const rawProfile = (settings.tax_profile ?? null) as OrganizationTaxProfile | null;
      const normalizedEntity =
        rawProfile?.legalEntityType ??
        DEFAULT_ORGANIZATION_TAX_PROFILE.legalEntityType;
      const normalizedCompanyName =
        rawProfile?.companyName ??
        (settings.photography_business_name as string | null) ??
        DEFAULT_ORGANIZATION_TAX_PROFILE.companyName;
      const derivedVatExempt =
        rawProfile?.vatExempt ?? normalizedEntity === "freelance";
      return {
        ...DEFAULT_ORGANIZATION_TAX_PROFILE,
        ...(rawProfile ?? {}),
        legalEntityType: normalizedEntity,
        companyName: normalizedCompanyName,
        vatExempt: derivedVatExempt,
      };
    },
    enabled: !!activeOrganizationId,
    staleTime: ORGANIZATION_SETTINGS_CACHE_TTL,
    initialData: () => ({ ...DEFAULT_ORGANIZATION_TAX_PROFILE }),
  });
}

export function useSessionStatuses() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ['session_statuses', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];
      
      const { data, error } = await supabase
        .from('session_statuses')
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

export { useOrganizationSettings } from "./useOrganizationSettings";
