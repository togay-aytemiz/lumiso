import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { detectBrowserTimezone, detectBrowserHourFormat } from '@/lib/dateFormatUtils';
import { resolveMembershipStatus, shouldPersistMembershipStatus } from '@/lib/membershipStatus';
import type { MembershipStatus } from '@/types/membership';
import { useTranslation } from "react-i18next";
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
import { useConnectivity } from './useConnectivity';
import { isNetworkError } from '@/lib/utils';

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
  gallery_storage_limit_bytes?: number | null;
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

const ORG_DETAILS_CACHE_TTL_MS = 5 * 60 * 1000;
const ORG_DETAILS_MIN_FETCH_INTERVAL_MS = 60 * 1000;
const ORG_DETAILS_STORAGE_PREFIX = "lumiso:organization_details:";

type OrgDetailsCacheEntry = {
  data: Organization | null;
  cachedAt: number;
};

const getOrgDetailsStorageKey = (orgId: string) =>
  `${ORG_DETAILS_STORAGE_PREFIX}${orgId}`;

const readOrgDetailsFromStorage = (
  orgId: string,
  ttl: number = ORG_DETAILS_CACHE_TTL_MS
): OrgDetailsCacheEntry | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(getOrgDetailsStorageKey(orgId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as OrgDetailsCacheEntry;
    if (!parsed || typeof parsed !== "object") return undefined;
    if (typeof parsed.cachedAt !== "number") return undefined;
    if (Date.now() - parsed.cachedAt > ttl) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const writeOrgDetailsToStorage = (orgId: string, data: Organization | null) => {
  if (typeof window === "undefined") return;
  if (!data) return;
  try {
    window.localStorage.setItem(
      getOrgDetailsStorageKey(orgId),
      JSON.stringify({ data, cachedAt: Date.now() } satisfies OrgDetailsCacheEntry)
    );
  } catch {
    // Best-effort only
  }
};

const clearOrgDetailsStorage = (orgId?: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (orgId) {
      window.localStorage.removeItem(getOrgDetailsStorageKey(orgId));
      return;
    }
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(ORG_DETAILS_STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Best-effort only
  }
};

const orgDetailsCache = new Map<string, OrgDetailsCacheEntry>();
const orgDetailsInflight = new Map<string, Promise<Organization | null>>();

const getOrgDetailsFromCache = (
  orgId: string,
  ttl: number = ORG_DETAILS_CACHE_TTL_MS
): Organization | null | undefined => {
  const entry = orgDetailsCache.get(orgId);
  if (entry && Date.now() - entry.cachedAt < ttl) {
    return entry.data;
  }
  const stored = readOrgDetailsFromStorage(orgId, ttl);
  if (stored !== undefined) {
    orgDetailsCache.set(orgId, stored);
    return stored.data;
  }
  return undefined;
};

const setOrgDetailsCache = (orgId: string, data: Organization | null) => {
  orgDetailsCache.set(orgId, { data, cachedAt: Date.now() });
  writeOrgDetailsToStorage(orgId, data);
};

const clearOrgDetailsCache = (orgId?: string | null) => {
  if (!orgId) {
    orgDetailsCache.clear();
    orgDetailsInflight.clear();
    clearOrgDetailsStorage();
    return;
  }
  orgDetailsCache.delete(orgId);
  orgDetailsInflight.delete(orgId);
  clearOrgDetailsStorage(orgId);
};

const resolveOrganization = (org: Organization) => {
  const normalized: Organization = {
    ...org,
    membership_status: (org.membership_status as MembershipStatus | null) ?? null,
    computed_trial_started_at: null,
    computed_trial_ends_at: null,
    membership_access_blocked: false,
  };
  const resolution = resolveMembershipStatus(normalized);
  return {
    normalized: {
      ...normalized,
      membership_status: resolution.status,
      computed_trial_started_at: resolution.trialStartedAt,
      computed_trial_ends_at: resolution.trialEndsAt,
      membership_access_blocked: resolution.shouldBlockAccess,
    },
    resolution,
  };
};

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const activeOrganizationIdRef = useRef<string | null>(null);
  const activeOrganizationRef = useRef<Organization | null>(null);
  const lastOrgFetchAtRef = useRef(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["messages", "common"]);
  const { reportNetworkError, reportRecovery } = useConnectivity();

  useEffect(() => {
    activeOrganizationIdRef.current = activeOrganizationId;
  }, [activeOrganizationId]);

  useEffect(() => {
    activeOrganizationRef.current = activeOrganization;
  }, [activeOrganization]);

  const fetchActiveOrganization = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const skipLoadingState = options?.silent ?? false;
      const forceFetch = options?.force ?? false;
      try {
        if (!skipLoadingState) {
          setLoading(true);
        }

      const nowTs = Date.now();
      if (!forceFetch && nowTs - lastOrgFetchAtRef.current < ORG_DETAILS_MIN_FETCH_INTERVAL_MS) {
        if (activeOrganizationRef.current?.id) {
          return;
        }
      }

      const cachedOrgId = activeOrganizationIdRef.current;
      let orgId = cachedOrgId;
      if (!orgId) {
        const { getUserOrganizationId } = await import('@/lib/organizationUtils');
        orgId = await getUserOrganizationId();
      }

      if (!orgId) {
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        clearOrgDetailsCache();
          return;
        }

        if (!forceFetch) {
          const cachedOrg = getOrgDetailsFromCache(orgId);
          if (cachedOrg !== undefined) {
            if (!cachedOrg) {
              setActiveOrganizationId(null);
              setActiveOrganization(null);
              return;
            }
            setActiveOrganizationId(orgId);
            setActiveOrganization(cachedOrg);
            reportRecovery();
            return;
          }
        }

        lastOrgFetchAtRef.current = Date.now();

        const inflightRequest = orgDetailsInflight.get(orgId);
        if (inflightRequest) {
          const cachedOrg = await inflightRequest;
          if (!cachedOrg) {
            setActiveOrganizationId(null);
            setActiveOrganization(null);
            return;
          }
          setActiveOrganizationId(orgId);
          setActiveOrganization(cachedOrg);
          reportRecovery();
          return;
        }

        const requestPromise = (async () => {
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
                'gallery_storage_limit_bytes',
              ].join(', ')
            )
            .eq('id', orgId)
            .single();

          if (orgDetailsError) {
            throw orgDetailsError;
          }

          if (!org) {
            return null;
          }

          const { normalized: normalizedOrg, resolution } = resolveOrganization(org as Organization);

          if (shouldPersistMembershipStatus(org as Organization, resolution)) {
            const { error: statusUpdateError } = await supabase
              .from('organizations')
              .update({ membership_status: resolution.status })
              .eq('id', org.id);

            if (statusUpdateError) {
              console.error('Failed to persist membership status:', statusUpdateError);
            }
          }

          return normalizedOrg;
        })()
          .then((resolvedOrg) => {
            setOrgDetailsCache(orgId, resolvedOrg);
            return resolvedOrg;
          })
          .finally(() => {
            orgDetailsInflight.delete(orgId);
          });

        orgDetailsInflight.set(orgId, requestPromise);

        const resolvedOrg = await requestPromise;
        if (!resolvedOrg) {
          setActiveOrganizationId(null);
          setActiveOrganization(null);
          return;
        }

        setActiveOrganizationId(orgId);
        setActiveOrganization(resolvedOrg);
        reportRecovery();
      } catch (error) {
        console.error('Error in fetchActiveOrganization:', error);
        if (isNetworkError(error)) {
          reportNetworkError(error, 'service');
        }
      } finally {
        if (!skipLoadingState) {
          setLoading(false);
        }
      }
    },
    [reportNetworkError, reportRecovery]
  );

  const refreshOrganization = async () => {
    await fetchActiveOrganization({ force: true });
  };

  const setActiveOrganizationHandler = async (orgId: string) => {
    // In single-photographer model, organization is determined by ownership
    // No need to update user settings since getUserOrganizationId handles this
    console.log('Organization switch not needed in single-photographer mode:', orgId);

    // Just refresh the organization data
    await refreshOrganization();

    toast({
      title: t("toast.success", { ns: "common" }),
      description: t("success.organizationRefreshed", { ns: "messages" }),
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
        clearOrgDetailsCache();
        setLoading(false);
      }
    };

    initializeOrganization();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          fetchActiveOrganization({ silent: true });
        } else if (event === 'SIGNED_OUT') {
          setActiveOrganizationId(null);
          setActiveOrganization(null);
          clearOrgDetailsCache();
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
            'gallery_storage_limit_bytes',
          ] as const;

          const hasRelevantChange = relevantFields.some((field) => {
            return payload.old?.[field] !== payload.new?.[field];
          });

          if (hasRelevantChange) {
            if (!payload.new) return;
            const { normalized } = resolveOrganization(payload.new as Organization);
            setOrgDetailsCache(normalized.id, normalized);
            setActiveOrganizationId(normalized.id);
            setActiveOrganization(normalized);
            reportRecovery();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrganizationId, reportRecovery]);

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
