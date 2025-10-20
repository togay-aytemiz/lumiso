import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
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
    try {
      const { data, error } = await supabase.rpc('leads_filter_page', {
        org: organizationId,
        p_page: Math.floor(from / Math.max(to - from + 1, 1)) + 1,
        p_size: to - from + 1,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_status_ids: (statusIds && statusIds.length ? statusIds : null),
        p_filters: customFieldFilters ?? {}
      });
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      const total = rows.length ? Number(rows[0].total_count) : 0;
      const leads: LeadWithCustomFields[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        status: r.status,
        status_id: r.status_id,
        updated_at: r.updated_at,
        created_at: r.created_at,
        assignees: [],
        custom_fields: {},
        lead_statuses: r.lead_statuses
      }));
      return { leads, count: includeCount ? total : leads.length };
    } catch (e) {
      // Fallback to previous set-based approach (still server-side) if RPC unavailable
      const matched = await resolveLeadIdsForCustomFilters(organizationId);
      if (matched && matched.size === 0) return { leads: [], count: 0 };
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
      const leads: LeadWithCustomFields[] = raw.map((lead: any) => ({ ...lead, assignees: [], custom_fields: {} }));
      return { leads, count };
    }
  }, [customFieldFilters, resolveLeadIdsForCustomFilters, sortDirection, sortField, statusIds]);

  const fetchLeads = useCallback(async () => {
    const first = firstLoadRef.current;
    try {
      if (first) setInitialLoading(true);
      setTableLoading(true);
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No active organization found');
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { leads, count } = await fetchLeadsData({ from, to, includeCount: true });
      setPageLeads(leads);
      setTotalCount(count);

      // Lightweight metrics query for recent window (last 60 days) + count already fetched
      const since = new Date();
      since.setDate(since.getDate() - 60);
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
      const metricsResult = await metricsQuery;
      if (metricsResult.error) throw metricsResult.error;
      setMetricsLeads((metricsResult.data as any[]) ?? []);
    } finally {
      setTableLoading(false);
      if (first) {
        setInitialLoading(false);
        firstLoadRef.current = false;
      }
    }
  }, [fetchLeadsData, page, pageSize, statusIds]);

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
