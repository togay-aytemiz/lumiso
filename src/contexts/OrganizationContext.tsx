import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { detectBrowserTimezone, detectBrowserHourFormat } from '@/lib/dateFormatUtils';
import { resolveMembershipStatus, shouldPersistMembershipStatus } from '@/lib/membershipStatus';
import type { MembershipStatus } from '@/types/membership';
import {
  fetchOrganizationSettingsWithCache,
  ORGANIZATION_SETTINGS_CACHE_TTL,
} from '@/lib/organizationSettingsCache';
import {
  LEAD_FIELD_DEFINITIONS_GC_TIME,
  LEAD_FIELD_DEFINITIONS_STALE_TIME,
  fetchLeadFieldDefinitionsForOrganization,
  leadFieldDefinitionsQueryKey,
} from '@/services/leadFieldDefinitions';

interface Organization {
  id: string;
  name: string;
  owner_id: string;
  membership_status: MembershipStatus | null;
  manual_flag: boolean;
  manual_flag_reason: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  trial_extended_by_days: number | null;
  trial_extension_reason: string | null;
  premium_plan: string | null;
  premium_activated_at: string | null;
  premium_expires_at: string | null;
  created_at: string | null;
  computed_trial_started_at: string | null;
  computed_trial_ends_at: string | null;
  membership_access_blocked: boolean;
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

  const fetchActiveOrganization = useCallback(async (options?: { silent?: boolean }) => {
    const skipLoadingState = options?.silent ?? false;
    try {
      if (!skipLoadingState) {
        setLoading(true);
      }
      
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
        .select(
          [
            'id',
            'created_at',
            'name',
            'owner_id',
            'membership_status',
            'manual_flag',
            'manual_flag_reason',
            'trial_started_at',
            'trial_expires_at',
            'trial_extended_by_days',
            'trial_extension_reason',
            'premium_plan',
            'premium_activated_at',
            'premium_expires_at',
          ].join(', ')
        )
        .eq('id', orgId)
        .single();

      if (orgDetailsError) {
        console.error('Error getting organization details:', orgDetailsError);
        return;
      }

      if (!org) {
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        return;
      }

      let normalizedOrg: Organization = {
        ...org,
        membership_status: (org.membership_status as MembershipStatus | null) ?? null,
        computed_trial_started_at: null,
        computed_trial_ends_at: null,
        membership_access_blocked: false,
      };
      const resolution = resolveMembershipStatus(normalizedOrg);

      if (shouldPersistMembershipStatus(normalizedOrg, resolution)) {
        const { error: statusUpdateError } = await supabase
          .from('organizations')
          .update({ membership_status: resolution.status })
          .eq('id', org.id);

        if (statusUpdateError) {
          console.error('Failed to persist membership status:', statusUpdateError);
        } else {
          normalizedOrg = { ...normalizedOrg, membership_status: resolution.status };
        }
      }

      normalizedOrg = {
        ...normalizedOrg,
        membership_status: resolution.status,
        computed_trial_started_at: resolution.trialStartedAt,
        computed_trial_ends_at: resolution.trialEndsAt,
        membership_access_blocked: resolution.shouldBlockAccess,
      };

      setActiveOrganizationId(orgId);
      setActiveOrganization(normalizedOrg);
    } catch (error) {
      console.error('Error in fetchActiveOrganization:', error);
    } finally {
      if (!skipLoadingState) {
        setLoading(false);
      }
    }
  }, []);

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
    let presenceInterval: ReturnType<typeof setInterval> | null = null;

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
  }, [fetchActiveOrganization]);

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
          const detectedHourFormat =
            typeof window !== 'undefined' ? detectBrowserHourFormat() : undefined;
          return fetchOrganizationSettingsWithCache(orgId, {
            detectedTimezone,
            detectedHourFormat,
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
          if (!user.user) return [];
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

    // Session types
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: ['session_types', orgId],
        queryFn: async () => {
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) return [];
          await supabase.rpc('ensure_default_session_types_for_org', {
            user_uuid: user.user.id,
            org_id: orgId,
          });
          const { data, error } = await supabase
            .from('session_types')
            .select('*')
            .eq('organization_id', orgId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    // Lead field definitions (settings collections)
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: leadFieldDefinitionsQueryKey(orgId),
        queryFn: () => fetchLeadFieldDefinitionsForOrganization(orgId),
        staleTime: LEAD_FIELD_DEFINITIONS_STALE_TIME,
        gcTime: LEAD_FIELD_DEFINITIONS_GC_TIME,
      })
    );

    await Promise.allSettled(tasks);
  }, [queryClient]);

  // Trigger prefetch whenever org becomes available
  useEffect(() => {
    if (activeOrganizationId) {
      prefetchOrgData(activeOrganizationId);
    }
  }, [activeOrganizationId, prefetchOrgData]);

  useEffect(() => {
    if (!activeOrganizationId) {
      return;
    }

    const channel = supabase
      .channel(`org-membership:${activeOrganizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${activeOrganizationId}`,
        },
        (payload) => {
          const relevantFields = [
            'membership_status',
            'manual_flag',
            'manual_flag_reason',
            'trial_started_at',
            'trial_expires_at',
            'trial_extended_by_days',
            'premium_activated_at',
            'premium_expires_at',
          ] as const;

          const hasRelevantChange = relevantFields.some((field) => {
            return payload.old?.[field] !== payload.new?.[field];
          });

          if (hasRelevantChange) {
            void fetchActiveOrganization({ silent: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrganizationId, fetchActiveOrganization]);

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
