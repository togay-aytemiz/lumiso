import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PROJECT_SELECT_FIELDS,
  SEARCH_MIN_CHARS,
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
} from "../constants";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import type {
  Payment,
  PaymentStatusFilter,
  PaymentTypeFilter,
  ProjectDetails,
  SortDirection,
  SortField,
} from "../types";

type ProjectRecord = {
  id: string;
  name: string;
  base_price: number | null;
  lead_id: string | null;
  status_id: string | null;
  previous_status_id: string | null;
  project_type_id: string | null;
  description: string | null;
  updated_at: string | null;
  created_at: string | null;
  user_id: string | null;
  project_statuses?: { name?: string | null } | null;
};

type LeadSummary = { id: string; name: string };

interface SearchContext {
  projectDetailsMap: Map<string, ProjectDetails>;
  leadDetailsMap: Map<string, LeadSummary>;
  pendingLeadIds: Set<string>;
  searchProjectIds: Set<string>;
  archivedProjectIds: Set<string>;
  upsertProjects: (projects: ProjectRecord[] | null | undefined) => void;
  assignProjectLead: () => void;
}

type FetchPaymentsDataOptions = {
  range?: { from: number; to: number };
  includeMetrics?: boolean;
  includeCount?: boolean;
  includeScheduled?: boolean;
  activeDateRangeOverride?: { start: Date; end: Date } | null;
};

interface UsePaymentsDataOptions {
  page: number;
  pageSize: number;
  sortField: SortField;
  sortDirection: SortDirection;
  statusFilters: PaymentStatusFilter[];
  typeFilters: PaymentTypeFilter[];
  amountMinFilter: number | null;
  amountMaxFilter: number | null;
  searchTerm: string;
  activeDateRange: { start: Date; end: Date } | null;
  onError: (error: Error) => void;
  scheduledAmountMinFilter?: number | null;
  scheduledAmountMaxFilter?: number | null;
}

interface UsePaymentsDataResult {
  paginatedPayments: Payment[];
  metricsPayments: Payment[];
  scheduledPayments: Payment[];
  totalCount: number;
  initialLoading: boolean;
  tableLoading: boolean;
  fetchPayments: () => Promise<void>;
  fetchPaymentsData: (options?: FetchPaymentsDataOptions) => Promise<{
    payments: Payment[];
    count: number;
    metricsData: Payment[] | null;
    scheduledPayments?: Payment[] | null;
  }>;
}

type EnrichedPayment = Payment & { projects: ProjectDetails | null };

const LOG_TIMESTAMP_FIELD = "log_timestamp";
const paymentSchemaEnhancementsEnabled =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_ENABLE_PAYMENT_SCHEMA_ENHANCEMENTS === "true") ||
  false;

const isLogTimestampMissingError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybe = error as { code?: string; message?: string; details?: string };
  if (maybe.code === "42703") {
    return true;
  }
  const payload = `${maybe.message ?? ""} ${maybe.details ?? ""}`.toLowerCase();
  return payload.includes(LOG_TIMESTAMP_FIELD);
};

const sortEnrichedPayments = (
  payments: EnrichedPayment[],
  sortField: SortField,
  sortDirection: SortDirection
): EnrichedPayment[] => {
  const ascending = sortDirection === "asc";
  const localeCompareOptions: Intl.CollatorOptions = { sensitivity: "base" };

  if (sortField === "project_name") {
    return [...payments].sort((a, b) => {
      const aName = a.projects?.name || "";
      const bName = b.projects?.name || "";
      return ascending
        ? aName.localeCompare(bName, undefined, localeCompareOptions)
        : bName.localeCompare(aName, undefined, localeCompareOptions);
    });
  }

  if (sortField === "lead_name") {
    return [...payments].sort((a, b) => {
      const aName = a.projects?.leads?.name || "";
      const bName = b.projects?.leads?.name || "";
      return ascending
        ? aName.localeCompare(bName, undefined, localeCompareOptions)
        : bName.localeCompare(aName, undefined, localeCompareOptions);
    });
  }

  if (sortField === "date_paid") {
    return [...payments].sort((a, b) => {
      const rawDateA = a.log_timestamp ?? a.date_paid ?? a.created_at;
      const rawDateB = b.log_timestamp ?? b.date_paid ?? b.created_at;
      const dateA = new Date(rawDateA);
      const dateB = new Date(rawDateB);
      const rawTimeA = Number.isNaN(dateA.getTime()) ? null : dateA.getTime();
      const rawTimeB = Number.isNaN(dateB.getTime()) ? null : dateB.getTime();
      const timeA =
        rawTimeA === null
          ? ascending
            ? Number.MAX_SAFE_INTEGER
            : Number.MIN_SAFE_INTEGER
          : rawTimeA;
      const timeB =
        rawTimeB === null
          ? ascending
            ? Number.MAX_SAFE_INTEGER
            : Number.MIN_SAFE_INTEGER
          : rawTimeB;
      const diff = timeA - timeB;
      return ascending ? diff : -diff;
    });
  }

  if (sortField === "amount") {
    return [...payments].sort((a, b) => {
      const diff = Number(a.amount) - Number(b.amount);
      return ascending ? diff : -diff;
    });
  }

  if (sortField === "description") {
    return [...payments].sort((a, b) => {
      const aValue = a.description || "";
      const bValue = b.description || "";
      return ascending
        ? aValue.localeCompare(bValue, undefined, localeCompareOptions)
        : bValue.localeCompare(aValue, undefined, localeCompareOptions);
    });
  }

  if (sortField === "status") {
    return [...payments].sort((a, b) => {
      const aValue = a.status || "";
      const bValue = b.status || "";
      return ascending
        ? aValue.localeCompare(bValue, undefined, localeCompareOptions)
        : bValue.localeCompare(aValue, undefined, localeCompareOptions);
    });
  }

  if (sortField === "type") {
    return [...payments].sort((a, b) => {
      const aValue = a.type || "";
      const bValue = b.type || "";
      return ascending
        ? aValue.localeCompare(bValue, undefined, localeCompareOptions)
        : bValue.localeCompare(aValue, undefined, localeCompareOptions);
    });
  }

  return [...payments];
};

const buildError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "Unknown error");
};

export function usePaymentsData({
  page,
  pageSize,
  sortField,
  sortDirection,
  statusFilters,
  typeFilters,
  amountMinFilter,
  amountMaxFilter,
  searchTerm,
  activeDateRange,
  onError,
  scheduledAmountMinFilter = null,
  scheduledAmountMaxFilter = null,
}: UsePaymentsDataOptions): UsePaymentsDataResult {
  const [paginatedPayments, setPaginatedPayments] = useState<Payment[]>([]);
  const [metricsPayments, setMetricsPayments] = useState<Payment[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const initialLoadRef = useRef(true);
  const lastFetchedPageRef = useRef(0);

  const archivedStatusIdRef = useRef<string | null>(null);
  const logTimestampSupportedRef = useRef<boolean | null>(
    process.env.NODE_ENV === "test"
      ? true
      : paymentSchemaEnhancementsEnabled
        ? null
        : false
  );
  const logTimestampSupportPromiseRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const organizationId = await getUserOrganizationId();
        if (!organizationId) {
          archivedStatusIdRef.current = null;
          return;
        }
        const { data, error } = await supabase
          .from("project_statuses")
          .select("id")
          .eq("organization_id", organizationId)
          .ilike("name", "archived")
          .maybeSingle();
        if (error) throw error;
        archivedStatusIdRef.current = data?.id ?? null;
      } catch (error) {
        console.error("Failed to load archived status id", error);
        archivedStatusIdRef.current = null;
      }
    })();
  }, []);

  const ensureLogTimestampSupport = useCallback(async () => {
    if (!paymentSchemaEnhancementsEnabled) {
      return false;
    }
    if (logTimestampSupportedRef.current !== null) {
      return logTimestampSupportedRef.current;
    }
    if (logTimestampSupportPromiseRef.current) {
      return logTimestampSupportPromiseRef.current;
    }
    const probe = (async () => {
      const { error } = await supabase
        .from("payments")
        .select(LOG_TIMESTAMP_FIELD)
        .limit(1);
      if (error && !isLogTimestampMissingError(error)) {
        console.warn("[payments] Unable to confirm log timestamp support:", error);
      }
      logTimestampSupportedRef.current = error ? false : true;
      return logTimestampSupportedRef.current;
    })();
    logTimestampSupportPromiseRef.current = probe.finally(() => {
      logTimestampSupportPromiseRef.current = null;
    });
    return logTimestampSupportPromiseRef.current;
  }, []);

  const createSearchContext = useCallback(
    async (globalSearchTerm: string): Promise<SearchContext> => {
      const projectDetailsMap = new Map<string, ProjectDetails>();
      const leadDetailsMap = new Map<string, LeadSummary>();
      const pendingLeadIds = new Set<string>();
      const searchProjectIds = new Set<string>();
      const archivedProjectIds = new Set<string>();

      const upsertProjects = (projects: ProjectRecord[] | null | undefined) => {
        const archivedStatusId = archivedStatusIdRef.current;
        projects?.forEach((project) => {
          if (archivedStatusId && project.status_id === archivedStatusId) {
            archivedProjectIds.add(project.id);
            return;
          }
          projectDetailsMap.set(project.id, {
            id: project.id,
            name: project.name,
            base_price: project.base_price ?? null,
            lead_id: project.lead_id ?? null,
            status_id: project.status_id ?? null,
            previous_status_id: project.previous_status_id ?? null,
            project_type_id: project.project_type_id ?? null,
            description: project.description ?? null,
            updated_at: project.updated_at ?? undefined,
            created_at: project.created_at ?? undefined,
            user_id: project.user_id ?? undefined,
            leads: null,
          });

          if (project.lead_id && !leadDetailsMap.has(project.lead_id)) {
            pendingLeadIds.add(project.lead_id);
          }
        });
      };

      if (globalSearchTerm.length) {
        const { data: projectNameMatches, error: projectNameError } = await supabase
          .from("projects")
          .select(PROJECT_SELECT_FIELDS)
          .ilike("name", `%${globalSearchTerm}%`);

        if (projectNameError) throw projectNameError;

        upsertProjects(projectNameMatches);
        projectNameMatches?.forEach((project) => searchProjectIds.add(project.id));

        const { data: searchLeadMatches, error: searchLeadsError } = await supabase
          .from("leads")
          .select("id, name")
          .ilike("name", `%${globalSearchTerm}%`);

        if (searchLeadsError) throw searchLeadsError;

        const searchLeadIds = searchLeadMatches?.map((lead) => lead.id) ?? [];
        searchLeadMatches?.forEach((lead) => leadDetailsMap.set(lead.id, lead));

        if (searchLeadIds.length) {
          const { data: projectsForLeads, error: projectsForLeadsError } = await supabase
            .from("projects")
            .select(PROJECT_SELECT_FIELDS)
            .in("lead_id", searchLeadIds);

          if (projectsForLeadsError) throw projectsForLeadsError;

          upsertProjects(projectsForLeads);
          projectsForLeads?.forEach((project) => searchProjectIds.add(project.id));
        }
      }

      const assignProjectLead = () => {
        projectDetailsMap.forEach((project, id) => {
          const lead = project.lead_id ? leadDetailsMap.get(project.lead_id) ?? null : null;
          projectDetailsMap.set(id, { ...project, leads: lead });
        });
      };

      return {
        projectDetailsMap,
        leadDetailsMap,
        pendingLeadIds,
        searchProjectIds,
        archivedProjectIds,
        upsertProjects,
        assignProjectLead,
      };
    },
    []
  );

  const hydratePayments = useCallback(
    async (paymentsList: Payment[], context: SearchContext): Promise<EnrichedPayment[]> => {
      const {
        projectDetailsMap,
        leadDetailsMap,
        pendingLeadIds,
        upsertProjects,
        assignProjectLead,
        archivedProjectIds,
      } = context;

      const projectIds = Array.from(
        new Set(
          paymentsList
            .map((payment) => payment.project_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const missingProjectIds = projectIds.filter((id) => !projectDetailsMap.has(id));

      if (missingProjectIds.length) {
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select(PROJECT_SELECT_FIELDS)
          .in("id", missingProjectIds);

        if (projectsError) throw projectsError;

        upsertProjects(projectsData);
      }

      const missingLeadList = Array.from(pendingLeadIds).filter((id) => !leadDetailsMap.has(id));

      if (missingLeadList.length) {
        const { data: leadsData, error: leadsError } = await supabase
          .from("leads")
          .select("id, name")
          .in("id", missingLeadList);

        if (leadsError) throw leadsError;

        leadsData?.forEach((lead) => leadDetailsMap.set(lead.id, lead));
      }

      assignProjectLead();

      return paymentsList
        .filter((payment) => !archivedProjectIds.has(payment.project_id))
        .map((payment) => ({
          ...payment,
          projects: payment.project_id ? projectDetailsMap.get(payment.project_id) ?? null : null,
        }));
    },
    []
  );

  const fetchPaymentsData = useCallback(
    async (options?: FetchPaymentsDataOptions) => {
      const supportsLogTimestamp = await ensureLogTimestampSupport();
      const {
        range,
        includeMetrics = false,
        includeCount = false,
        includeScheduled = false,
        activeDateRangeOverride,
      } = options ?? {};
      const effectiveDateRange =
        activeDateRangeOverride === undefined ? activeDateRange : activeDateRangeOverride;
      const rawSearch = searchTerm.trim();
      const globalSearchTerm =
        rawSearch.length >= SEARCH_MIN_CHARS ? rawSearch : "";

      const hasMinAmount = amountMinFilter !== null && !Number.isNaN(amountMinFilter);
      const hasMaxAmount = amountMaxFilter !== null && !Number.isNaN(amountMaxFilter);
      const minAmountValue = hasMinAmount ? Number(amountMinFilter) : null;
      const maxAmountValue = hasMaxAmount ? Number(amountMaxFilter) : null;

      const shouldFilterTypes =
        typeFilters.length > 0 && typeFilters.length < TYPE_FILTER_OPTIONS.length;
      const refundOnly = statusFilters.length === 1 && statusFilters[0] === "refund";
      const standardStatuses = statusFilters.filter((status) => status !== "refund");
      const totalStandardStatuses =
        STATUS_FILTER_OPTIONS.filter((status) => status !== "refund").length;
      const shouldFilterStandardStatuses =
        standardStatuses.length > 0 && standardStatuses.length < totalStandardStatuses;

      const context = await createSearchContext(globalSearchTerm);

      const searchFilters =
        globalSearchTerm.length > 0
          ? (() => {
              const sanitized = globalSearchTerm.replace(/"/g, '""');
              const filters = [
                `description.ilike."%${sanitized}%"`,
                `status.ilike."%${sanitized}%"`,
                `type.ilike."%${sanitized}%"`,
              ];
              if (context.searchProjectIds.size) {
                filters.push(`project_id.in.(${Array.from(context.searchProjectIds).join(",")})`);
              }
              return filters;
            })()
          : null;

      const runFetch = async (useLogTimestamp: boolean) => {
        let tableQuery = supabase
          .from("payments")
          .select("*", { count: includeCount ? "exact" : undefined });

        if (effectiveDateRange) {
          const startISO = effectiveDateRange.start.toISOString();
          const endISO = effectiveDateRange.end.toISOString();
          if (useLogTimestamp) {
            tableQuery = tableQuery.gte(LOG_TIMESTAMP_FIELD, startISO).lte(LOG_TIMESTAMP_FIELD, endISO);
          } else {
            const paidWindow = `and(entry_kind.eq.recorded,status.ilike.paid,date_paid.gte.${startISO},date_paid.lte.${endISO})`;
            const createdWindow = `and(entry_kind.eq.recorded,status.ilike.paid,date_paid.is.null,created_at.gte.${startISO},created_at.lte.${endISO})`;
            const refundWindow = `and(entry_kind.eq.recorded,amount.lt.0,created_at.gte.${startISO},created_at.lte.${endISO})`;
            tableQuery = tableQuery.or([paidWindow, createdWindow, refundWindow].join(","));
          }
        }

        if (refundOnly) {
          tableQuery = tableQuery.lt("amount", 0);
        } else if (shouldFilterStandardStatuses) {
          if (standardStatuses.length === 1) {
            tableQuery = tableQuery.ilike("status", standardStatuses[0]);
          } else {
            tableQuery = tableQuery.in("status", standardStatuses);
          }
        }

        if (shouldFilterTypes) {
          tableQuery = tableQuery.in("type", typeFilters);
        }

        if (hasMinAmount) {
          tableQuery = tableQuery.gte("amount", minAmountValue as number);
        }

        if (hasMaxAmount) {
          tableQuery = tableQuery.lte("amount", maxAmountValue as number);
        }

        if (searchFilters?.length) {
          tableQuery = tableQuery.or(searchFilters.join(","));
        }

        tableQuery = tableQuery.or(
          "and(entry_kind.eq.recorded,status.ilike.paid),and(entry_kind.eq.recorded,amount.lt.0)"
        );

        const ascending = sortDirection === "asc";

        switch (sortField) {
          case "date_paid":
            if (useLogTimestamp) {
              tableQuery = tableQuery
                .order(LOG_TIMESTAMP_FIELD, { ascending, nullsLast: true })
                .order("created_at", { ascending });
            } else {
              tableQuery = tableQuery
                .order("date_paid", { ascending, nullsLast: true })
                .order("created_at", { ascending });
            }
            break;
          case "amount":
          case "description":
          case "status":
          case "type":
            tableQuery = tableQuery.order(sortField, { ascending });
            break;
          default:
            tableQuery = tableQuery.order("created_at", { ascending: false });
            break;
        }

        if (range) {
          tableQuery = tableQuery.range(range.from, range.to);
        }

        const tableResult = await tableQuery;
        if (tableResult.error) {
          throw tableResult.error;
        }

        let metricsData: Payment[] | null = null;
        let scheduledData: Payment[] | null = null;

        if (includeMetrics) {
          const metricFields = [
            "id",
            "amount",
            "status",
            "type",
            "date_paid",
            "created_at",
            "updated_at",
            "project_id",
            "entry_kind",
            "scheduled_initial_amount",
            "scheduled_remaining_amount",
          ];
          if (useLogTimestamp) {
            metricFields.splice(5, 0, LOG_TIMESTAMP_FIELD);
          }

          let metricsQuery = supabase.from("payments").select(metricFields.join(", "));

          if (effectiveDateRange) {
            const startISO = effectiveDateRange.start.toISOString();
            const endISO = effectiveDateRange.end.toISOString();
            if (useLogTimestamp) {
              metricsQuery = metricsQuery.gte(LOG_TIMESTAMP_FIELD, startISO).lte(LOG_TIMESTAMP_FIELD, endISO);
            } else {
              const paidWindow = `and(entry_kind.eq.recorded,status.ilike.paid,date_paid.gte.${startISO},date_paid.lte.${endISO})`;
              const createdWindow = `and(entry_kind.eq.recorded,status.ilike.paid,date_paid.is.null,created_at.gte.${startISO},created_at.lte.${endISO})`;
              const refundWindow = `and(entry_kind.eq.recorded,amount.lt.0,created_at.gte.${startISO},created_at.lte.${endISO})`;
              metricsQuery = metricsQuery.or([paidWindow, createdWindow, refundWindow].join(","));
            }
          }

          if (refundOnly) {
            metricsQuery = metricsQuery.lt("amount", 0);
          } else if (shouldFilterStandardStatuses) {
            if (standardStatuses.length === 1) {
              metricsQuery = metricsQuery.ilike("status", standardStatuses[0]);
            } else {
              metricsQuery = metricsQuery.in("status", standardStatuses);
            }
          }

          if (shouldFilterTypes) {
            metricsQuery = metricsQuery.in("type", typeFilters);
          }

          if (hasMinAmount) {
            metricsQuery = metricsQuery.gte("amount", minAmountValue as number);
          }

          if (hasMaxAmount) {
            metricsQuery = metricsQuery.lte("amount", maxAmountValue as number);
          }

          if (searchFilters?.length) {
            metricsQuery = metricsQuery.or(searchFilters.join(","));
          }

          const metricsResult = await metricsQuery;
          if (metricsResult.error) {
            throw metricsResult.error;
          }
          const rawMetrics = (metricsResult.data as Payment[] | null) ?? null;
          if (rawMetrics?.length) {
            const metricsProjectIds = Array.from(
              new Set(
                rawMetrics
                  .map((payment) => payment.project_id)
                  .filter((id): id is string => Boolean(id))
              )
            );
            const missingForMetrics = metricsProjectIds.filter(
              (id) => !context.projectDetailsMap.has(id) && !context.archivedProjectIds.has(id)
            );
            if (missingForMetrics.length) {
              const { data: metricsProjects, error: metricsProjectsError } = await supabase
                .from("projects")
                .select(PROJECT_SELECT_FIELDS)
                .in("id", missingForMetrics);

              if (metricsProjectsError) throw metricsProjectsError;

              context.upsertProjects(metricsProjects);
            }
          }

          metricsData = rawMetrics
            ? rawMetrics.filter((payment) => !context.archivedProjectIds.has(payment.project_id))
            : null;
        }

        if (includeScheduled) {
          let scheduledQuery = supabase
            .from("payments")
            .select("*")
            .eq("entry_kind", "scheduled")
            .gt("scheduled_remaining_amount", 0);

          if (scheduledAmountMinFilter != null && Number.isFinite(scheduledAmountMinFilter)) {
            scheduledQuery = scheduledQuery.gte(
              "scheduled_remaining_amount",
              Number(scheduledAmountMinFilter)
            );
          }

          if (scheduledAmountMaxFilter != null && Number.isFinite(scheduledAmountMaxFilter)) {
            scheduledQuery = scheduledQuery.lte(
              "scheduled_remaining_amount",
              Number(scheduledAmountMaxFilter)
            );
          }

          if (searchFilters?.length) {
            scheduledQuery = scheduledQuery.or(searchFilters.join(","));
          }

          scheduledQuery = scheduledQuery.order("updated_at", { ascending: false });

          const scheduledResult = await scheduledQuery;
          if (scheduledResult.error) {
            throw scheduledResult.error;
          }

          const scheduledRaw = (scheduledResult.data as Payment[] | null) ?? [];
          scheduledData = await hydratePayments(scheduledRaw, context);
        }

        const tableData = (tableResult.data as Payment[] | null) ?? [];
        const enriched = await hydratePayments(tableData, context);
        const sorted = sortEnrichedPayments(enriched, sortField, sortDirection);

        const computedCount = includeCount
          ? tableResult.count ?? sorted.length
          : sorted.length;

        return {
          payments: sorted,
          count: computedCount,
          metricsData,
          scheduledPayments: scheduledData,
        };
      };

      try {
        return await runFetch(supportsLogTimestamp);
      } catch (error) {
        if (logTimestampSupportedRef.current && isLogTimestampMissingError(error)) {
          console.warn(
            "[payments] Falling back to legacy date filters because log_timestamp is unavailable."
          );
          logTimestampSupportedRef.current = false;
          logTimestampSupportPromiseRef.current = null;
          return runFetch(false);
        }
        throw error;
      }
    },
    [
      activeDateRange,
      amountMaxFilter,
      amountMinFilter,
      createSearchContext,
      hydratePayments,
      searchTerm,
      sortDirection,
      sortField,
      statusFilters,
      typeFilters,
      ensureLogTimestampSupport,
      scheduledAmountMaxFilter,
      scheduledAmountMinFilter,
    ]
  );

  const mergePayments = useCallback((prev: Payment[], next: Payment[]) => {
    if (prev.length === 0) return next;
    if (next.length === 0) return prev;
    const map = new Map(prev.map((payment) => [payment.id, payment]));
    const merged = [...prev];
    for (const payment of next) {
      const existing = map.get(payment.id);
      if (existing) {
        const index = merged.findIndex((row) => row.id === payment.id);
        if (index !== -1) {
          merged[index] = payment;
        }
      } else {
        merged.push(payment);
        map.set(payment.id, payment);
      }
    }
    return merged;
  }, []);

  const fetchPayments = useCallback(async () => {
    const isInitialLoad = initialLoadRef.current;
    let fetchedPayments: Payment[] = [];
    let fetchedCount = 0;
    try {
      if (isInitialLoad) {
        setInitialLoading(true);
      }
      setTableLoading(true);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { payments, count, metricsData, scheduledPayments: scheduledData } = await fetchPaymentsData({
        range: { from, to },
        includeMetrics: true,
        includeCount: true,
        includeScheduled: true,
      });

      fetchedPayments = payments;
      fetchedCount = count;
      setPaginatedPayments((prev) => {
        const shouldAppend = page > lastFetchedPageRef.current;
        if (!shouldAppend) {
          return payments;
        }
        return mergePayments(prev, payments);
      });
      setTotalCount(count);
      setMetricsPayments(metricsData ?? []);
      if (scheduledData) {
        setScheduledPayments(scheduledData);
      } else if (page === 1) {
        setScheduledPayments([]);
      }
      lastFetchedPageRef.current = page;
    } catch (error) {
      onError(buildError(error));
    } finally {
      setTableLoading(false);
      if (isInitialLoad) {
        setInitialLoading(false);
        initialLoadRef.current = false;
      }
    }
  }, [fetchPaymentsData, mergePayments, onError, page, pageSize]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return useMemo(
    () => ({
      paginatedPayments,
      metricsPayments,
      scheduledPayments,
      totalCount,
      initialLoading,
      tableLoading,
      fetchPayments,
      fetchPaymentsData,
    }),
    [
      fetchPayments,
      fetchPaymentsData,
      initialLoading,
      metricsPayments,
      scheduledPayments,
      paginatedPayments,
      tableLoading,
      totalCount,
    ]
  );
}
