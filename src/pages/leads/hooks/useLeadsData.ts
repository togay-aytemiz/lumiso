import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { DEV, startTimer, logInfo } from "@/lib/debug";
import type { LeadWithCustomFields } from "@/hooks/useLeadsWithCustomFields";
import type { CustomFieldFilterValue } from "@/pages/leads/hooks/useLeadsFilters";

export type LeadSortField = "updated_at" | "created_at" | "name";
export type LeadSortDirection = "asc" | "desc";

interface UseLeadsDataOptions {
  page: number;
  pageSize: number;
  sortField: LeadSortField;
  sortDirection: LeadSortDirection;
  statusIds?: string[]; // server-side status filter
  customFieldFilters?: Record<string, CustomFieldFilterValue>;
}

interface UseLeadsDataResult {
  pageLeads: LeadWithCustomFields[];
  metricsLeads: Pick<LeadWithCustomFields, "id" | "created_at" | "updated_at" | "status" | "lead_statuses">[];
  totalCount: number;
  initialLoading: boolean;
  tableLoading: boolean;
  refetch: () => Promise<void>;
  fetchLeadsData: (opts: { from: number; to: number; includeCount?: boolean }) => Promise<{ leads: LeadWithCustomFields[]; count: number }>;
}

export function useLeadsData({
  page,
  pageSize,
  sortField,
  sortDirection,
  statusIds,
  customFieldFilters,
}: UseLeadsDataOptions): UseLeadsDataResult {
  const [pageLeads, setPageLeads] = useState<LeadWithCustomFields[]>([]);
  const [metricsLeads, setMetricsLeads] = useState<
    Pick<LeadWithCustomFields, "id" | "created_at" | "updated_at" | "status" | "lead_statuses">[]
  >([]);
  const [totalCount, setTotalCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const firstLoadRef = useRef(true);
  const lastFetchedPageRef = useRef(0);

  // Intersect lead IDs that satisfy all custom-field filters
  const resolveLeadIdsForCustomFilters = useCallback(async (organizationId: string) => {
    const entries = Object.entries(customFieldFilters ?? {}).filter(([, v]) => Boolean(v));
    if (!entries.length) return null as null | Set<string>;
    let acc: Set<string> | null = null;
    for (const [fieldKey, filter] of entries) {
      let ids: string[] = [];
      if (filter.type === 'text') {
        const q = (filter.value || '').trim();
        if (!q) continue;
        // Try typed view first; if not present, fallback to an inner join on leads
        try {
          const { data, error } = await supabase
            .from('lead_field_values_typed')
            .select('lead_id')
            .eq('organization_id', organizationId)
            .eq('field_key', fieldKey)
            .ilike('value', `%${q}%`);
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        } catch {
          const { data, error } = await supabase
            .from('lead_field_values')
            .select('lead_id, leads!inner(organization_id)')
            .eq('leads.organization_id', organizationId)
            .eq('field_key', fieldKey)
            .ilike('value', `%${q}%`);
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        }
      } else if (filter.type === 'checkbox') {
        if (filter.value === 'any') continue;
        const wantTrue = filter.value === 'checked';
        try {
          const { data, error } = await supabase
            .from('lead_field_values_typed')
            .select('lead_id,value_bool')
            .eq('organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (error) throw error;
          ids = (data ?? [])
            .filter((r: any) => (wantTrue ? r.value_bool === true : (r.value_bool === false || r.value_bool === null)))
            .map((r: any) => r.lead_id);
        } catch {
          const { data, error } = await supabase
            .from('lead_field_values')
            .select('lead_id, value, leads!inner(organization_id)')
            .eq('leads.organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (error) throw error;
          ids = (data ?? [])
            .filter((r: any) => {
              const v = String(r.value ?? '').toLowerCase();
              return wantTrue ? (v === 'true' || v === '1' || v === 'yes' || v === 'y') : (v === 'false' || v === '0' || v === 'no' || v === 'n' || v === '');
            })
            .map((r: any) => r.lead_id);
        }
      } else if (filter.type === 'select') {
        if (!filter.values?.length) continue;
        const ors = filter.values
          .map((v) => `value.ilike."%${String(v).replace(/\"/g, '""')}%"`)
          .join(',');
        try {
          let q2 = supabase
            .from('lead_field_values_typed')
            .select('lead_id')
            .eq('organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (ors.length) q2 = q2.or(ors);
          const { data, error } = await q2;
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        } catch {
          let qj = supabase
            .from('lead_field_values')
            .select('lead_id, leads!inner(organization_id)')
            .eq('leads.organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (ors.length) qj = qj.or(ors);
          const { data, error } = await qj;
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        }
      } else if (filter.type === 'date') {
        const start = (filter.start || '').trim();
        const end = (filter.end || '').trim();
        if (!start && !end) continue;
        try {
          let q = supabase
            .from('lead_field_values_typed')
            .select('lead_id,value_date')
            .eq('organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (start) q = q.gte('value_date', start);
          if (end) q = q.lte('value_date', end);
          const { data, error } = await q;
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        } catch {
          let q = supabase
            .from('lead_field_values')
            .select('lead_id, value, leads!inner(organization_id)')
            .eq('leads.organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (start) q = q.gte('value', start);
          if (end) q = q.lte('value', end);
          const { data, error } = await q;
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        }
      } else if (filter.type === 'number') {
        const min = (filter.min || '').trim();
        const max = (filter.max || '').trim();
        if (!min && !max) continue;
        try {
          let q = supabase
            .from('lead_field_values_typed')
            .select('lead_id,value_number')
            .eq('organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (min) q = q.gte('value_number', Number(min));
          if (max) q = q.lte('value_number', Number(max));
          const { data, error } = await q;
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        } catch {
          // Fallback to string compare if typed view is unavailable
          let q = supabase
            .from('lead_field_values')
            .select('lead_id, value, leads!inner(organization_id)')
            .eq('leads.organization_id', organizationId)
            .eq('field_key', fieldKey);
          if (min) q = q.gte('value', String(min));
          if (max) q = q.lte('value', String(max));
          const { data, error } = await q;
          if (error) throw error;
          ids = (data ?? []).map((r: any) => r.lead_id);
        }
      } else {
        // unsupported type for server intersection
        continue;
      }
      const set = new Set(ids);
      acc = acc ? new Set(Array.from(acc).filter(id => set.has(id))) : set;
      if (acc.size === 0) return new Set<string>();
    }
    return acc;
  }, [customFieldFilters]);

  const fetchLeadsData = useCallback(async ({ from, to, includeCount = false }: { from: number; to: number; includeCount?: boolean }) => {
    const organizationId = await getUserOrganizationId();
    if (!organizationId) throw new Error('No active organization found');
    const page = Math.floor(from / Math.max(to - from + 1, 1)) + 1;
    const size = to - from + 1;
    const t = startTimer('Leads.fetchPage', {
      page,
      size,
      includeCount,
      sortField,
      sortDirection,
      statusIdsCount: statusIds?.length ?? 0,
      customFieldFilterKeys: Object.keys(customFieldFilters || {}).length,
    });
    // Fast path: serve first page from prefetch cache when filters are default
    try {
      const isDefault =
        page === 1 &&
        size === 25 &&
        (!statusIds || statusIds.length === 0) &&
        (!customFieldFilters || Object.keys(customFieldFilters).length === 0) &&
        sortField === 'updated_at' &&
        sortDirection === 'desc';
      if (isDefault && typeof window !== 'undefined') {
        const raw = localStorage.getItem(`prefetch:leads:first:${organizationId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts?: number; value?: { items?: any[]; total?: number; ttl?: number } };
          const ts = parsed?.ts ?? 0;
          const ttl = parsed?.value?.ttl ?? 60_000;
          if (Date.now() - ts < ttl) {
            const rows = (parsed?.value?.items ?? []) as any[];
            const total = parsed?.value?.total ?? (rows.length ? rows.length : 0);
            let leads: LeadWithCustomFields[] = rows.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              phone: r.phone,
              status: r.status,
              status_id: r.status_id,
              updated_at: r.updated_at,
              created_at: r.created_at,
              custom_fields: {},
              lead_statuses: r.lead_statuses,
            }));
            if (leads.length) {
              const leadIds = leads.map((l) => l.id);
              try {
                const { data: cfTyped, error: cfTypedErr } = await supabase
                  .from('lead_field_values_typed')
                  .select('lead_id, field_key, value')
                  .eq('organization_id', organizationId)
                  .in('lead_id', leadIds);
                let cfRows: any[] | null = null;
                if (!cfTypedErr) {
                  cfRows = cfTyped as any[];
                } else {
                  const { data: cfRaw, error: cfRawErr } = await supabase
                    .from('lead_field_values')
                    .select('lead_id, field_key, value, leads!inner(organization_id)')
                    .eq('leads.organization_id', organizationId)
                    .in('lead_id', leadIds);
                  if (!cfRawErr) cfRows = cfRaw as any[];
                }
                if (cfRows && cfRows.length) {
                  const byLead: Record<string, Record<string, string | null>> = {};
                  for (const r of cfRows) {
                    const lid = r.lead_id;
                    if (!byLead[lid]) byLead[lid] = {};
                    byLead[lid][r.field_key] = r.value;
                  }
                  leads = leads.map((l) => ({ ...l, custom_fields: byLead[l.id] || {} }));
                }
              } catch {}
            }
            t.end({ leads: leads.length, total, source: 'prefetch' });
            return { leads, count: includeCount ? total : leads.length };
          }
        }
      }
    } catch {}
    try {
      const tRpc = startTimer('Leads.rpc.leads_filter_page');
      const { data, error } = await supabase.rpc('leads_filter_page', {
        org: organizationId,
        p_page: page,
        p_size: size,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_status_ids: (statusIds && statusIds.length ? statusIds : null),
        p_filters: customFieldFilters ?? {}
      });
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      const total = rows.length ? Number(rows[0].total_count) : 0;
      tRpc.end({ rows: rows.length, total });
      let leads: LeadWithCustomFields[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        status: r.status,
        status_id: r.status_id,
        updated_at: r.updated_at,
        created_at: r.created_at,
        custom_fields: {},
        lead_statuses: r.lead_statuses
      }));
      // Populate custom field values for the current page to display in table columns
      if (leads.length) {
        const leadIds = leads.map((l) => l.id);
        // Try typed view first for better performance
        const tCF = startTimer('Leads.customFields.pageFetch');
        const { data: cfTyped, error: cfTypedErr } = await supabase
          .from('lead_field_values_typed')
          .select('lead_id, field_key, value')
          .eq('organization_id', organizationId)
          .in('lead_id', leadIds);
        let cfRows: any[] | null = null;
        if (!cfTypedErr) {
          cfRows = cfTyped as any[];
        } else {
          const { data: cfRaw, error: cfRawErr } = await supabase
            .from('lead_field_values')
            .select('lead_id, field_key, value, leads!inner(organization_id)')
            .eq('leads.organization_id', organizationId)
            .in('lead_id', leadIds);
          if (!cfRawErr) cfRows = cfRaw as any[];
        }
        if (cfRows && cfRows.length) {
          const byLead: Record<string, Record<string, string | null>> = {};
          for (const r of cfRows) {
            const lid = r.lead_id;
            if (!byLead[lid]) byLead[lid] = {};
            byLead[lid][r.field_key] = r.value;
          }
          leads = leads.map((l) => ({ ...l, custom_fields: byLead[l.id] || {} }));
        }
        tCF.end({ leadIds: leadIds.length, values: cfRows?.length ?? 0 });
      }
      t.end({ leads: leads.length, total });
      return { leads, count: includeCount ? total : leads.length };
    } catch (e) {
      logInfo('Leads.rpc.fallback', { reason: (e as any)?.message || String(e) });
      // Fallback to previous set-based approach (still server-side) if RPC unavailable
      const matched = await resolveLeadIdsForCustomFilters(organizationId);
      if (matched && matched.size === 0) return { leads: [], count: 0 };
      const tFallback = startTimer('Leads.fallback.query');
      let base = supabase
        .from('leads')
        .select(`id, name, email, phone, status, status_id, updated_at, created_at, lead_statuses ( id, name, color, is_system_final )`, { count: includeCount ? 'exact' : undefined })
        .eq('organization_id', organizationId);
      if (statusIds && statusIds.length) base = base.in('status_id', statusIds);
      if (matched) base = base.in('id', Array.from(matched));
      const asc = sortDirection === 'asc';
      const sortCol = sortField === 'name' ? 'name' : sortField === 'created_at' ? 'created_at' : 'updated_at';
      base = base.order(sortCol, { ascending: asc, nullsFirst: !asc });
      const table = await base.range(from, to);
      if (table.error) throw table.error;
      const raw = (table.data as any[]) ?? [];
      const count = includeCount ? (table.count ?? raw.length) : raw.length;
      let leads: LeadWithCustomFields[] = raw.map((lead: any) => ({ ...lead, custom_fields: {} }));
      // Populate custom field values for the fetched leads (fallback path)
      if (leads.length) {
        const leadIds = leads.map((l) => l.id);
        try {
          const tCF2 = startTimer('Leads.fallback.customFields.pageFetch');
          const { data: cfTyped, error: cfTypedErr } = await supabase
            .from('lead_field_values_typed')
            .select('lead_id, field_key, value')
            .eq('organization_id', organizationId)
            .in('lead_id', leadIds);
          let cfRows: any[] | null = null;
          if (!cfTypedErr) {
            cfRows = cfTyped as any[];
          } else {
            const { data: cfRaw, error: cfRawErr } = await supabase
              .from('lead_field_values')
              .select('lead_id, field_key, value, leads!inner(organization_id)')
              .eq('leads.organization_id', organizationId)
              .in('lead_id', leadIds);
            if (!cfRawErr) cfRows = cfRaw as any[];
          }
          if (cfRows && cfRows.length) {
            const byLead: Record<string, Record<string, string | null>> = {};
            for (const r of cfRows) {
              const lid = r.lead_id;
              if (!byLead[lid]) byLead[lid] = {};
              byLead[lid][r.field_key] = r.value;
            }
            leads = leads.map((l) => ({ ...l, custom_fields: byLead[l.id] || {} }));
          }
          tCF2.end({ leadIds: leadIds.length });
        } catch {
          // ignore
        }
      }
      tFallback.end({ leads: leads.length, count });
      t.end({ leads: leads.length, total: count });
      return { leads, count };
    }
  }, [customFieldFilters, resolveLeadIdsForCustomFilters, sortDirection, sortField, statusIds]);

  const mergeLeads = useCallback((prev: LeadWithCustomFields[], next: LeadWithCustomFields[]) => {
    if (prev.length === 0) return next;
    if (next.length === 0) return prev;
    const map = new Map(prev.map((lead) => [lead.id, lead]));
    const merged = [...prev];
    for (const lead of next) {
      const existing = map.get(lead.id);
      if (existing) {
        const index = merged.findIndex((row) => row.id === lead.id);
        if (index !== -1) {
          merged[index] = lead;
        }
      } else {
        merged.push(lead);
        map.set(lead.id, lead);
      }
    }
    return merged;
  }, []);

  const fetchLeads = useCallback(async () => {
    const first = firstLoadRef.current;
    let fetchedLeads: LeadWithCustomFields[] = [];
    let fetchedCount = 0;
    try {
      if (first) setInitialLoading(true);
      setTableLoading(true);
      const t = startTimer('Leads.pageLoad', { page, pageSize });
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No active organization found');
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { leads, count } = await fetchLeadsData({ from, to, includeCount: true });
      fetchedLeads = leads;
      fetchedCount = count;
      setPageLeads((prev) => {
        const shouldAppend = page > lastFetchedPageRef.current;
        if (!shouldAppend) {
          return leads;
        }
        return mergeLeads(prev, leads);
      });
      setTotalCount(count);
      lastFetchedPageRef.current = page;

      // Lightweight metrics query for recent window (last 60 days) + count already fetched
      const since = new Date();
      since.setDate(since.getDate() - 60);
      // Try prefetched metrics to render instantly
      try {
        if (typeof window !== 'undefined' && page === 1) {
          const raw = localStorage.getItem(`prefetch:leads:metrics:${organizationId}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { ts?: number; value?: { items?: any[]; ttl?: number } };
            const ts = parsed?.ts ?? 0;
            const ttl = parsed?.value?.ttl ?? 60_000;
            if (Date.now() - ts < ttl && Array.isArray(parsed?.value?.items)) {
              setMetricsLeads(parsed!.value!.items as any[]);
            }
          }
        }
      } catch {}

      // Always fetch fresh metrics in background, update when arrives
      (async () => {
        let metricsQuery = supabase
          .from("leads")
          .select(
            `id, created_at, updated_at, status, lead_statuses ( id, name, color, is_system_final )`
          )
          .eq("organization_id", organizationId)
          .gte("created_at", since.toISOString());
        if (statusIds && statusIds.length) {
          metricsQuery = metricsQuery.in("status_id", statusIds);
        }
        const tMetrics = startTimer('Leads.metrics.window60d');
        const metricsResult = await metricsQuery;
        if (!metricsResult.error) {
          setMetricsLeads((metricsResult.data as any[]) ?? []);
        }
        tMetrics.end({ metrics: metricsResult.data?.length ?? 0 });
      })().catch(() => {});
    } finally {
      setTableLoading(false);
      if (first) {
        setInitialLoading(false);
        firstLoadRef.current = false;
      }
      t.end({ totalCount: fetchedCount, leads: fetchedLeads.length });
    }
  }, [fetchLeadsData, mergeLeads, page, pageSize, statusIds]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return useMemo(
    () => ({
      pageLeads,
      metricsLeads,
      totalCount,
      initialLoading,
      tableLoading,
      refetch: fetchLeads,
      fetchLeadsData,
    }),
    [fetchLeads, fetchLeadsData, initialLoading, metricsLeads, pageLeads, tableLoading, totalCount]
  );
}
