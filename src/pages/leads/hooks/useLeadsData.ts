import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { DEV, startTimer, logInfo } from "@/lib/debug";
import type { LeadWithCustomFields } from "@/hooks/useLeadsWithCustomFields";
import type { CustomFieldFilterValue } from "@/pages/leads/hooks/useLeadsFilters";

type LeadStatusRow = Pick<
  Database["public"]["Tables"]["lead_statuses"]["Row"],
  "id" | "name" | "color" | "is_system_final"
>;

type LeadStatusRelation = LeadStatusRow | LeadStatusRow[] | null | undefined;

interface LeadSupabaseRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  status_id: string;
  updated_at: string;
  created_at: string;
  lead_statuses: LeadStatusRelation;
}

interface LeadSupabaseRowWithTotal extends LeadSupabaseRow {
  total_count: number | string | null;
}

interface PrefetchedLeadRecord extends Partial<LeadSupabaseRow> {
  id: string;
  name: string;
  status: string;
  status_id: string;
  updated_at: string;
  created_at: string;
  lead_statuses?: LeadStatusRelation;
  custom_fields?: Record<string, string | null>;
}

interface PrefetchCachePayload {
  ts?: number;
  value?: {
    items?: PrefetchedLeadRecord[];
    total?: number;
    ttl?: number;
  };
}

interface MetricsPrefetchPayload {
  ts?: number;
  value?: {
    items?: LeadMetricsRow[];
    ttl?: number;
  };
}

interface CustomFieldValueRow {
  lead_id: string;
  field_key: string;
  value: string | null;
}

interface CustomFieldValueRowWithLead extends CustomFieldValueRow {
  leads?: {
    organization_id: string | null;
  } | null;
}

type LeadMetricsRow = Pick<
  LeadSupabaseRow,
  "id" | "created_at" | "updated_at" | "status" | "lead_statuses"
>;

type LeadIdRow = Pick<CustomFieldValueRow, "lead_id">;

const PREFETCH_DEFAULT_TTL = 60_000;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeLeadStatuses = (
  value: LeadStatusRelation
): LeadWithCustomFields["lead_statuses"] => {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }
  return value;
};

const toLeadWithCustomFields = (
  row: LeadSupabaseRow,
  customFields: Record<string, string | null> = {}
): LeadWithCustomFields => ({
  id: row.id,
  name: row.name ?? "",
  email: row.email ?? "",
  phone: row.phone ?? "",
  status: row.status ?? "",
  status_id: row.status_id ?? "",
  updated_at: row.updated_at,
  created_at: row.created_at,
  custom_fields: customFields,
  lead_statuses: normalizeLeadStatuses(row.lead_statuses),
});

const fromPrefetchedRecord = (record: PrefetchedLeadRecord): LeadSupabaseRow => ({
  id: record.id,
  name: record.name,
  email: record.email ?? null,
  phone: record.phone ?? null,
  status: record.status,
  status_id: record.status_id,
  updated_at: record.updated_at,
  created_at: record.created_at,
  lead_statuses: record.lead_statuses ?? null,
});

const groupCustomFieldValues = (
  rows: CustomFieldValueRow[] | null
): Record<string, Record<string, string | null>> => {
  if (!rows?.length) {
    return {};
  }
  return rows.reduce<Record<string, Record<string, string | null>>>(
    (acc, row) => {
      if (!acc[row.lead_id]) {
        acc[row.lead_id] = {};
      }
      acc[row.lead_id][row.field_key] = row.value;
      return acc;
    },
    {}
  );
};

const fetchCustomFieldValuesMap = async (
  organizationId: string,
  leadIds: string[]
): Promise<Record<string, Record<string, string | null>>> => {
  if (!leadIds.length) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from("lead_field_values_typed")
      .select("lead_id, field_key, value")
      .eq("organization_id", organizationId)
      .in("lead_id", leadIds)
      .returns<CustomFieldValueRow[]>();
    if (error) {
      throw error;
    }
    return groupCustomFieldValues(data ?? []);
  } catch (typedError) {
    logInfo("Leads.customFields.typedFallback", {
      organizationId,
      leadCount: leadIds.length,
      message: getErrorMessage(typedError),
    });
    try {
      const { data, error } = await supabase
        .from("lead_field_values")
        .select("lead_id, field_key, value, leads!inner(organization_id)")
        .eq("leads.organization_id", organizationId)
        .in("lead_id", leadIds)
        .returns<CustomFieldValueRowWithLead[]>();
      if (error) {
        throw error;
      }
      const simplified =
        data?.map<CustomFieldValueRow>(({ lead_id, field_key, value }) => ({
          lead_id,
          field_key,
          value,
        })) ?? [];
      return groupCustomFieldValues(simplified);
    } catch (rawError) {
      logInfo("Leads.customFields.rawFallbackFailed", {
        organizationId,
        leadCount: leadIds.length,
        message: getErrorMessage(rawError),
      });
      return {};
    }
  }
};

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
  const resolveLeadIdsForCustomFilters = useCallback(
    async (organizationId: string) => {
      const entries = Object.entries(customFieldFilters ?? {}).filter(
        ([, value]) => Boolean(value)
      );
      if (!entries.length) {
        return null as Set<string> | null;
      }

      let acc: Set<string> | null = null;

      for (const [fieldKey, filter] of entries) {
        let ids: string[] = [];

        switch (filter.type) {
          case "text": {
            const query = (filter.value ?? "").trim();
            if (!query) {
              continue;
            }
            try {
              const { data, error } = await supabase
                .from("lead_field_values_typed")
                .select("lead_id")
                .eq("organization_id", organizationId)
                .eq("field_key", fieldKey)
                .ilike("value", `%${query}%`)
                .returns<LeadIdRow[]>();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            } catch (typedError) {
              logInfo("Leads.customFilters.textFallback", {
                fieldKey,
                message: getErrorMessage(typedError),
              });
              const { data, error } = await supabase
                .from("lead_field_values")
                .select("lead_id, leads!inner(organization_id)")
                .eq("leads.organization_id", organizationId)
                .eq("field_key", fieldKey)
                .ilike("value", `%${query}%`)
                .returns<CustomFieldValueRowWithLead[]>();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            }
            break;
          }
          case "checkbox": {
            if (filter.value === "any") {
              continue;
            }
            const wantTrue = filter.value === "checked";
            try {
              const { data, error } = await supabase
                .from("lead_field_values_typed")
                .select("lead_id, value_bool")
                .eq("organization_id", organizationId)
                .eq("field_key", fieldKey)
                .returns<
                  Array<
                    Pick<
                      CustomFieldValueRow,
                      "lead_id"
                    > & { value_bool: boolean | null }
                  >
                >();
              if (error) {
                throw error;
              }
              ids = (data ?? [])
                .filter((row) =>
                  wantTrue
                    ? row.value_bool === true
                    : row.value_bool === false || row.value_bool === null
                )
                .map((row) => row.lead_id);
            } catch (typedError) {
              logInfo("Leads.customFilters.checkboxFallback", {
                fieldKey,
                message: getErrorMessage(typedError),
              });
              const { data, error } = await supabase
                .from("lead_field_values")
                .select("lead_id, value, leads!inner(organization_id)")
                .eq("leads.organization_id", organizationId)
                .eq("field_key", fieldKey)
                .returns<CustomFieldValueRowWithLead[]>();
              if (error) {
                throw error;
              }
              ids = (data ?? [])
                .filter((row) => {
                  const normalized = (row.value ?? "").toLowerCase();
                  return wantTrue
                    ? normalized === "true" ||
                        normalized === "1" ||
                        normalized === "yes" ||
                        normalized === "y"
                    : normalized === "false" ||
                        normalized === "0" ||
                        normalized === "no" ||
                        normalized === "n" ||
                        normalized === "";
                })
                .map((row) => row.lead_id);
            }
            break;
          }
          case "select": {
            if (!filter.values?.length) {
              continue;
            }
            const ors = filter.values
              .map(
                (value) =>
                  `value.ilike."%${String(value).replace(/"/g, '""')}%"`
              )
              .join(",");
            try {
              let typedQuery = supabase
                .from("lead_field_values_typed")
                .select("lead_id")
                .eq("organization_id", organizationId)
                .eq("field_key", fieldKey);
              if (ors.length) {
                typedQuery = typedQuery.or(ors);
              }
              const { data, error } =
                await typedQuery.returns<LeadIdRow[]>();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            } catch (typedError) {
              logInfo("Leads.customFilters.selectFallback", {
                fieldKey,
                message: getErrorMessage(typedError),
              });
              let rawQuery = supabase
                .from("lead_field_values")
                .select("lead_id, leads!inner(organization_id)")
                .eq("leads.organization_id", organizationId)
                .eq("field_key", fieldKey);
              if (ors.length) {
                rawQuery = rawQuery.or(ors);
              }
              const { data, error } =
                await rawQuery.returns<CustomFieldValueRowWithLead[]>();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            }
            break;
          }
          case "date": {
            const start = (filter.start ?? "").trim();
            const end = (filter.end ?? "").trim();
            if (!start && !end) {
              continue;
            }
            try {
              let typedQuery = supabase
                .from("lead_field_values_typed")
                .select("lead_id, value_date")
                .eq("organization_id", organizationId)
                .eq("field_key", fieldKey);
              if (start) {
                typedQuery = typedQuery.gte("value_date", start);
              }
              if (end) {
                typedQuery = typedQuery.lte("value_date", end);
              }
              const { data, error } =
                await typedQuery.returns<
                  Array<
                    Pick<CustomFieldValueRow, "lead_id"> & {
                      value_date: string | null;
                    }
                  >
                >();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            } catch (typedError) {
              logInfo("Leads.customFilters.dateFallback", {
                fieldKey,
                message: getErrorMessage(typedError),
              });
              let rawQuery = supabase
                .from("lead_field_values")
                .select("lead_id, value, leads!inner(organization_id)")
                .eq("leads.organization_id", organizationId)
                .eq("field_key", fieldKey);
              if (start) {
                rawQuery = rawQuery.gte("value", start);
              }
              if (end) {
                rawQuery = rawQuery.lte("value", end);
              }
              const { data, error } =
                await rawQuery.returns<CustomFieldValueRowWithLead[]>();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            }
            break;
          }
          case "number": {
            const min = (filter.min ?? "").trim();
            const max = (filter.max ?? "").trim();
            if (!min && !max) {
              continue;
            }
            try {
              let typedQuery = supabase
                .from("lead_field_values_typed")
                .select("lead_id, value_number")
                .eq("organization_id", organizationId)
                .eq("field_key", fieldKey);
              if (min) {
                typedQuery = typedQuery.gte("value_number", Number(min));
              }
              if (max) {
                typedQuery = typedQuery.lte("value_number", Number(max));
              }
              const { data, error } =
                await typedQuery.returns<
                  Array<
                    Pick<CustomFieldValueRow, "lead_id"> & {
                      value_number: number | null;
                    }
                  >
                >();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            } catch (typedError) {
              logInfo("Leads.customFilters.numberFallback", {
                fieldKey,
                message: getErrorMessage(typedError),
              });
              let rawQuery = supabase
                .from("lead_field_values")
                .select("lead_id, value, leads!inner(organization_id)")
                .eq("leads.organization_id", organizationId)
                .eq("field_key", fieldKey);
              if (min) {
                rawQuery = rawQuery.gte("value", String(min));
              }
              if (max) {
                rawQuery = rawQuery.lte("value", String(max));
              }
              const { data, error } =
                await rawQuery.returns<CustomFieldValueRowWithLead[]>();
              if (error) {
                throw error;
              }
              ids = (data ?? []).map((row) => row.lead_id);
            }
            break;
          }
          default:
            continue;
        }

        const set = new Set(ids);
        acc = acc
          ? new Set(Array.from(acc).filter((id) => set.has(id)))
          : set;
        if (acc.size === 0) {
          return new Set<string>();
        }
      }
      return acc;
    },
    [customFieldFilters]
  );

  const fetchLeadsData = useCallback(
    async ({
      from,
      to,
      includeCount = false,
    }: {
      from: number;
      to: number;
      includeCount?: boolean;
    }) => {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("No active organization found");
      }

      const size = to - from + 1;
      const page = Math.floor(from / Math.max(size, 1)) + 1;
      const timer = startTimer("Leads.fetchPage", {
        page,
        size,
        includeCount,
        sortField,
        sortDirection,
        statusIdsCount: statusIds?.length ?? 0,
        customFieldFilterKeys: Object.keys(customFieldFilters || {}).length,
      });

      try {
        const isDefaultRequest =
          page === 1 &&
          size === 25 &&
          (!statusIds || statusIds.length === 0) &&
          (!customFieldFilters ||
            Object.keys(customFieldFilters).length === 0) &&
          sortField === "updated_at" &&
          sortDirection === "desc";

        if (isDefaultRequest && typeof window !== "undefined") {
          try {
            const cacheKey = `prefetch:leads:first:${organizationId}`;
            const raw = localStorage.getItem(cacheKey);
            if (raw) {
              const parsed = JSON.parse(raw) as PrefetchCachePayload;
              const timestamp = parsed?.ts ?? 0;
              const ttl = parsed?.value?.ttl ?? PREFETCH_DEFAULT_TTL;
              if (Date.now() - timestamp < ttl) {
                const rows = parsed?.value?.items ?? [];
                const total =
                  parsed?.value?.total ?? (rows.length ? rows.length : 0);
                let leads = rows.map((row) =>
                  toLeadWithCustomFields(
                    fromPrefetchedRecord(row),
                    row.custom_fields ?? {}
                  )
                );
                if (leads.length) {
                  const leadIds = leads.map((lead) => lead.id);
                  const customFieldsMap = await fetchCustomFieldValuesMap(
                    organizationId,
                    leadIds
                  );
                  leads = leads.map((lead) => ({
                    ...lead,
                    custom_fields: {
                      ...lead.custom_fields,
                      ...(customFieldsMap[lead.id] ?? {}),
                    },
                  }));
                }
                timer.end({
                  leads: leads.length,
                  total,
                  source: "prefetch",
                });
                return {
                  leads,
                  count: includeCount ? total : leads.length,
                };
              }
            }
          } catch (prefetchError) {
            logInfo("Leads.prefetch.readError", {
              message: getErrorMessage(prefetchError),
            });
          }
        }

        try {
          const rpcTimer = startTimer("Leads.rpc.leads_filter_page");
          const { data, error } = await supabase
            .rpc("leads_filter_page", {
              org: organizationId,
              p_page: page,
              p_size: size,
              p_sort_field: sortField,
              p_sort_dir: sortDirection,
              p_status_ids:
                statusIds && statusIds.length ? statusIds : null,
              p_filters: customFieldFilters ?? {},
            })
            .returns<LeadSupabaseRowWithTotal[]>();
          if (error) {
            throw error;
          }
          const rows = data ?? [];
          const total = rows.length
            ? Number(rows[0].total_count ?? rows.length)
            : 0;
          rpcTimer.end({ rows: rows.length, total });
          let leads = rows.map((row) => toLeadWithCustomFields(row));

          if (leads.length) {
            const leadIds = leads.map((lead) => lead.id);
            const customFieldsMap = await fetchCustomFieldValuesMap(
              organizationId,
              leadIds
            );
            leads = leads.map((lead) => ({
              ...lead,
              custom_fields: customFieldsMap[lead.id] ?? {},
            }));
          }

          timer.end({ leads: leads.length, total });
          return { leads, count: includeCount ? total : leads.length };
        } catch (rpcError) {
          logInfo("Leads.rpc.fallback", {
            reason: getErrorMessage(rpcError),
          });
          const matchedIds = await resolveLeadIdsForCustomFilters(
            organizationId
          );
          if (matchedIds && matchedIds.size === 0) {
            timer.end({ leads: 0, total: 0, reason: "filters-empty" });
            return { leads: [], count: 0 };
          }

          const fallbackTimer = startTimer("Leads.fallback.query");
          let baseQuery = supabase
            .from("leads")
            .select(
              `id, name, email, phone, status, status_id, updated_at, created_at, lead_statuses ( id, name, color, is_system_final )`,
              { count: includeCount ? "exact" : undefined }
            )
            .eq("organization_id", organizationId);

          if (statusIds && statusIds.length) {
            baseQuery = baseQuery.in("status_id", statusIds);
          }
          if (matchedIds) {
            baseQuery = baseQuery.in("id", Array.from(matchedIds));
          }

          const ascending = sortDirection === "asc";
          const sortColumn =
            sortField === "name"
              ? "name"
              : sortField === "created_at"
                ? "created_at"
                : "updated_at";
          baseQuery = baseQuery.order(sortColumn, {
            ascending,
            nullsFirst: !ascending,
          });

          const pagedQuery = baseQuery.range(from, to);
          const table = await pagedQuery.returns<LeadSupabaseRow[]>();
          if (table.error) {
            throw table.error;
          }
          const rawRows = table.data ?? [];
          const count = includeCount
            ? table.count ?? rawRows.length
            : rawRows.length;
          let leads = rawRows.map((row) =>
            toLeadWithCustomFields(row, {})
          );

          if (leads.length) {
            const leadIds = leads.map((lead) => lead.id);
            const customFieldsMap = await fetchCustomFieldValuesMap(
              organizationId,
              leadIds
            );
            leads = leads.map((lead) => ({
              ...lead,
              custom_fields: customFieldsMap[lead.id] ?? {},
            }));
          }

          fallbackTimer.end({ leads: leads.length, count });
          timer.end({ leads: leads.length, total: count });
          return { leads, count };
        }
      } catch (error) {
        timer.end({ error: getErrorMessage(error) });
        throw error;
      }
    },
    [
      customFieldFilters,
      resolveLeadIdsForCustomFilters,
      sortDirection,
      sortField,
      statusIds,
    ]
  );

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
    const loadTimer = startTimer("Leads.pageLoad", { page, pageSize });

    try {
      if (first) {
        setInitialLoading(true);
      }
      setTableLoading(true);

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("No active organization found");
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { leads, count } = await fetchLeadsData({
        from,
        to,
        includeCount: true,
      });
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

      const since = new Date();
      since.setDate(since.getDate() - 60);

      if (typeof window !== "undefined" && page === 1) {
        try {
          const cacheKey = `prefetch:leads:metrics:${organizationId}`;
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw) as MetricsPrefetchPayload;
            const timestamp = parsed?.ts ?? 0;
            const ttl = parsed?.value?.ttl ?? PREFETCH_DEFAULT_TTL;
            const cachedItems = parsed?.value?.items;
            if (
              Date.now() - timestamp < ttl &&
              Array.isArray(cachedItems)
            ) {
              setMetricsLeads(cachedItems);
            }
          }
        } catch (metricsError) {
          logInfo("Leads.metrics.prefetchError", {
            message: getErrorMessage(metricsError),
          });
        }
      }

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
        const metricsTimer = startTimer("Leads.metrics.window60d");
        const metricsResult = await metricsQuery.returns<LeadMetricsRow[]>();
        if (!metricsResult.error && metricsResult.data) {
          setMetricsLeads(metricsResult.data);
        }
        metricsTimer.end({
          metrics: metricsResult.data?.length ?? 0,
        });
      })().catch((metricsError) => {
        logInfo("Leads.metrics.backgroundError", {
          message: getErrorMessage(metricsError),
        });
      });
    } finally {
      setTableLoading(false);
      if (first) {
        setInitialLoading(false);
        firstLoadRef.current = false;
      }
      loadTimer.end({
        totalCount: fetchedCount,
        leads: fetchedLeads.length,
      });
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
