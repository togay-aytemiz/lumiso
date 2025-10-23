import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

// Lightweight route-aware prefetcher for first pages of common lists
// Stores results in localStorage for hooks to bootstrap from.
const TTL_MS = 60 * 1000; // 1 minute

function setLS(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    const payload = { ts: Date.now(), value };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

export default function RoutePrefetcher() {
  const { pathname } = useLocation();
  const { activeOrganizationId } = useOrganization();
  const inFlightRef = useRef<Set<string>>(new Set());

  const hasFreshCache = useCallback((key: string) => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { ts?: number; value?: { ttl?: number } };
      const ts = parsed?.ts ?? 0;
      const ttl = parsed?.value?.ttl ?? TTL_MS;
      return ts > 0 && Date.now() - ts < ttl;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const orgId = activeOrganizationId;
    if (!orgId) return;

    const doProjects = async () => {
      const k = `prefetch:projects:first:${orgId}:active`;
      if (inFlightRef.current.has(k)) return;
      // Skip network prefetch if cached value is still fresh
      if (hasFreshCache(k)) return;
      inFlightRef.current.add(k);
      try {
        const { data, error } = await supabase.rpc('projects_filter_page', {
          org: orgId,
          p_page: 1,
          p_size: 25,
          p_sort_field: 'created_at',
          p_sort_dir: 'desc',
          p_scope: 'active',
          p_filters: {},
        });
        if (!error && Array.isArray(data)) {
          const total = data.length ? Number((data as any[])[0].total_count ?? 0) : 0;
          setLS(k, { items: data, total, ttl: TTL_MS });
        }
      } catch {}
      finally {
        inFlightRef.current.delete(k);
      }
    };

    const doLeads = async () => {
      const k = `prefetch:leads:first:${orgId}`;
      if (inFlightRef.current.has(k)) return;
      inFlightRef.current.add(k);
      try {
        const { data, error } = await supabase.rpc('leads_filter_page', {
          org: orgId,
          p_page: 1,
          p_size: 25,
          p_sort_field: 'updated_at',
          p_sort_dir: 'desc',
          p_status_ids: null,
          p_filters: {},
        });
        if (!error && Array.isArray(data)) {
          const total = data.length ? Number((data as any[])[0].total_count ?? 0) : 0;
          setLS(k, { items: data, total, ttl: TTL_MS });
        }
      } catch {}
      finally {
        inFlightRef.current.delete(k);
      }
    };

    const doLeadsMetrics = async () => {
      const k = `prefetch:leads:metrics:${orgId}`;
      if (inFlightRef.current.has(k)) return;
      inFlightRef.current.add(k);
      try {
        const since = new Date();
        since.setDate(since.getDate() - 60);
        const { data, error } = await supabase
          .from('leads')
          .select(`id, created_at, updated_at, status, lead_statuses ( id, name, color, is_system_final )`)
          .eq('organization_id', orgId)
          .gte('created_at', since.toISOString());
        if (!error && Array.isArray(data)) {
          setLS(k, { items: data, ttl: TTL_MS });
        }
      } catch {}
      finally {
        inFlightRef.current.delete(k);
      }
    };

    if (pathname.startsWith('/projects')) doProjects();
    if (pathname.startsWith('/leads')) { doLeads(); doLeadsMetrics(); }
  }, [pathname, activeOrganizationId, hasFreshCache]);

  return null;
}
