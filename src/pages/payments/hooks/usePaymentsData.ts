import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PROJECT_SELECT_FIELDS,
  SEARCH_MIN_CHARS,
  TYPE_FILTER_OPTIONS,
} from "../constants";
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
};

type LeadSummary = { id: string; name: string };

interface SearchContext {
  projectDetailsMap: Map<string, ProjectDetails>;
  leadDetailsMap: Map<string, LeadSummary>;
  pendingLeadIds: Set<string>;
  searchProjectIds: Set<string>;
  upsertProjects: (projects: ProjectRecord[] | null | undefined) => void;
  assignProjectLead: () => void;
}

type FetchPaymentsDataOptions = {
  range?: { from: number; to: number };
  includeMetrics?: boolean;
  includeCount?: boolean;
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
}

interface UsePaymentsDataResult {
  paginatedPayments: Payment[];
  metricsPayments: Payment[];
  totalCount: number;
  initialLoading: boolean;
  tableLoading: boolean;
  fetchPayments: () => Promise<void>;
  fetchPaymentsData: (options?: FetchPaymentsDataOptions) => Promise<{
    payments: Payment[];
    count: number;
    metricsData: Payment[] | null;
  }>;
}

type EnrichedPayment = Payment & { projects: ProjectDetails | null };

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
      const dateA = a.date_paid ? new Date(a.date_paid) : new Date(a.created_at);
      const dateB = b.date_paid ? new Date(b.date_paid) : new Date(b.created_at);
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
}: UsePaymentsDataOptions): UsePaymentsDataResult {
  const [paginatedPayments, setPaginatedPayments] = useState<Payment[]>([]);
  const [metricsPayments, setMetricsPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const initialLoadRef = useRef(true);

  const createSearchContext = useCallback(
    async (globalSearchTerm: string): Promise<SearchContext> => {
      const projectDetailsMap = new Map<string, ProjectDetails>();
      const leadDetailsMap = new Map<string, LeadSummary>();
      const pendingLeadIds = new Set<string>();
      const searchProjectIds = new Set<string>();

      const upsertProjects = (projects: ProjectRecord[] | null | undefined) => {
        projects?.forEach((project) => {
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

      return paymentsList.map((payment) => ({
        ...payment,
        projects: payment.project_id ? projectDetailsMap.get(payment.project_id) ?? null : null,
      }));
    },
    []
  );

  const fetchPaymentsData = useCallback(
    async (options?: FetchPaymentsDataOptions) => {
      const { range, includeMetrics = false, includeCount = false } = options ?? {};
      const rawSearch = searchTerm.trim();
      const globalSearchTerm =
        rawSearch.length >= SEARCH_MIN_CHARS ? rawSearch : "";

      const hasMinAmount = amountMinFilter !== null && !Number.isNaN(amountMinFilter);
      const hasMaxAmount = amountMaxFilter !== null && !Number.isNaN(amountMaxFilter);
      const minAmountValue = hasMinAmount ? Number(amountMinFilter) : null;
      const maxAmountValue = hasMaxAmount ? Number(amountMaxFilter) : null;

      const shouldFilterTypes =
        typeFilters.length > 0 && typeFilters.length < TYPE_FILTER_OPTIONS.length;

      const context = await createSearchContext(globalSearchTerm);

      const searchFilters =
        globalSearchTerm.length > 0
          ? (() => {
              const sanitized = globalSearchTerm.replace(/\"/g, '""');
              const filters = [
                `description.ilike.\"%${sanitized}%\"`,
                `status.ilike.\"%${sanitized}%\"`,
                `type.ilike.\"%${sanitized}%\"`,
              ];
              if (context.searchProjectIds.size) {
                filters.push(`project_id.in.(${Array.from(context.searchProjectIds).join(",")})`);
              }
              return filters;
            })()
          : null;

      let tableQuery = supabase
        .from("payments")
        .select("*", { count: includeCount ? "exact" : undefined });

      if (activeDateRange) {
        const startISO = activeDateRange.start.toISOString();
        const endISO = activeDateRange.end.toISOString();
        tableQuery = tableQuery.or(
          `and(date_paid.gte.${startISO},date_paid.lte.${endISO}),and(date_paid.is.null,created_at.gte.${startISO},created_at.lte.${endISO})`
        );
      }

      if (statusFilters.length === 1) {
        tableQuery = tableQuery.ilike("status", statusFilters[0]);
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

      const ascending = sortDirection === "asc";

      switch (sortField) {
        case "date_paid":
          tableQuery = tableQuery
            .order("date_paid", { ascending, nullsLast: true })
            .order("created_at", { ascending });
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

      if (includeMetrics) {
        let metricsQuery = supabase
          .from("payments")
          .select("id, amount, status, type, date_paid, created_at, project_id");

        if (activeDateRange) {
          const startISO = activeDateRange.start.toISOString();
          const endISO = activeDateRange.end.toISOString();
          metricsQuery = metricsQuery.or(
            `and(date_paid.gte.${startISO},date_paid.lte.${endISO}),and(date_paid.is.null,created_at.gte.${startISO},created_at.lte.${endISO})`
          );
        }

        if (statusFilters.length === 1) {
          metricsQuery = metricsQuery.ilike("status", statusFilters[0]);
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
        metricsData = (metricsResult.data as Payment[] | null) ?? null;
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
      };
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
    ]
  );

  const fetchPayments = useCallback(async () => {
    const isInitialLoad = initialLoadRef.current;
    try {
      if (isInitialLoad) {
        setInitialLoading(true);
      }
      setTableLoading(true);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { payments, count, metricsData } = await fetchPaymentsData({
        range: { from, to },
        includeMetrics: true,
        includeCount: true,
      });

      setPaginatedPayments(payments);
      setTotalCount(count);
      setMetricsPayments(metricsData ?? []);
    } catch (error) {
      onError(buildError(error));
    } finally {
      setTableLoading(false);
      if (isInitialLoad) {
        setInitialLoading(false);
        initialLoadRef.current = false;
      }
    }
  }, [fetchPaymentsData, onError, page, pageSize]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return useMemo(
    () => ({
      paginatedPayments,
      metricsPayments,
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
      paginatedPayments,
      tableLoading,
      totalCount,
    ]
  );
}
