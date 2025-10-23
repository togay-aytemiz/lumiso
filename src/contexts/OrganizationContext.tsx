import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { detectBrowserTimezone } from '@/lib/dateFormatUtils';
import {
  fetchOrganizationSettingsWithCache,
  ORGANIZATION_SETTINGS_CACHE_TTL,
} from '@/lib/organizationSettingsCache';

interface Organization {
  id: string;
  name: string;
  owner_id: string;
}

interface OrganizationContextType {
  activeOrganizationId: string | null;
  activeOrganization: Organization | null;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
  setActiveOrganization: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchActiveOrganization = async () => {
    try {
      setLoading(true);
      
      // Use the organization utils function
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const orgId = await getUserOrganizationId();
      
      if (!orgId) {
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        return;
      }

      // Fetch organization details
      const { data: org, error: orgDetailsError } = await supabase
        .from('organizations')
        .select('id, name, owner_id')
        .eq('id', orgId)
        .single();

      if (orgDetailsError) {
        console.error('Error getting organization details:', orgDetailsError);
        return;
      }

      setActiveOrganizationId(orgId);
      setActiveOrganization(org);
    } catch (error) {
      console.error('Error in fetchActiveOrganization:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganization = async () => {
    await fetchActiveOrganization();
  };

  const setActiveOrganizationHandler = async (orgId: string) => {
    // In single-photographer model, organization is determined by ownership
    // No need to update user settings since getUserOrganizationId handles this
    console.log('Organization switch not needed in single-photographer mode:', orgId);
    
    // Just refresh the organization data
    await refreshOrganization();
    
    toast({
      title: "Success", 
      description: "Organization data refreshed",
    });
  };

  // Set up simplified presence tracking for single-photographer
  useEffect(() => {
    let presenceInterval: any = null;

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activeOrganizationId) return;

      // Simple periodic activity update - no complex presence channels needed
      presenceInterval = setInterval(async () => {
        try {
          // Just update user_settings to show activity
          await supabase
            .from('user_settings')
            .update({ updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
        } catch (error) {
          console.warn('Failed to update activity timestamp:', error);
        }
      }, 300000); // Update every 5 minutes
    };

    if (activeOrganizationId) {
      setupPresence();
    }

    return () => {
      if (presenceInterval) {
        clearInterval(presenceInterval);
      }
    };
  }, [activeOrganizationId]);

  // Initialize on mount and when auth state changes
  useEffect(() => {
    const initializeOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetchActiveOrganization();
      } else {
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        setLoading(false);
      }
    };

    initializeOrganization();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          fetchActiveOrganization();
        } else if (event === 'SIGNED_OUT') {
          setActiveOrganizationId(null);
          setActiveOrganization(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Prefetch common organization-scoped data to speed up first paint across pages
  const prefetchOrgData = useCallback(async (orgId: string) => {
    const tasks: Array<Promise<unknown>> = [];

    // Project types
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['project_types', orgId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('project_types')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order');
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    // Project statuses
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['project_statuses', orgId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('project_statuses')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order');
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    // Services
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['services', orgId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('organization_id', orgId)
            .order('name');
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    // Session statuses
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['session_statuses', orgId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('session_statuses')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order');
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    // Lead statuses (used widely in leads and dialogs)
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['lead_statuses', orgId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('lead_statuses')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order');
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    // Organization settings (cache aware)
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['organization_settings', orgId],
        queryFn: async () => {
          const detectedTimezone =
            typeof window !== 'undefined' ? detectBrowserTimezone() : undefined;
          return fetchOrganizationSettingsWithCache(orgId, {
            detectedTimezone,
          });
        },
        staleTime: ORGANIZATION_SETTINGS_CACHE_TTL,
      })
    );

    // Packages (used by settings, dialogs)
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['packages', orgId],
        queryFn: async () => {
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) return [] as any[];
          await supabase.rpc('ensure_default_packages_for_org', {
            user_uuid: user.user.id,
            org_id: orgId,
          });
          const { data, error } = await supabase
            .from('packages')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    // Lead field definitions — not on React Query, seed localStorage for fast bootstrap
    tasks.push((async () => {
      try {
        await supabase.rpc('ensure_default_lead_field_definitions', { org_id: orgId, user_uuid: (await supabase.auth.getUser()).data.user?.id });
      } catch {}
      try {
        const { data, error } = await supabase
          .from('lead_field_definitions')
          .select('*')
          .eq('organization_id', orgId)
          .order('sort_order', { ascending: true });
        if (!error && data && typeof window !== 'undefined') {
          try { localStorage.setItem(`lead_field_definitions:${orgId}`, JSON.stringify(data)); } catch {}
        }
      } catch {}
    })());

    await Promise.allSettled(tasks);
  }, [queryClient]);

  // Trigger prefetch whenever org becomes available
  useEffect(() => {
    if (activeOrganizationId) {
      prefetchOrgData(activeOrganizationId);
    }
  }, [activeOrganizationId, prefetchOrgData]);

  return (
    <OrganizationContext.Provider
      value={{
        activeOrganizationId,
        activeOrganization,
        loading,
        refreshOrganization,
        setActiveOrganization: setActiveOrganizationHandler,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
