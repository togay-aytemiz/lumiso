import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { startTimer, logInfo } from "@/lib/debug";
import { isNetworkError } from "@/lib/utils";
import type {
  ProjectsArchivedFiltersState,
  ProjectsListFiltersState,
} from "@/pages/projects/hooks/useProjectsFilters";
import type { ProjectListItem, ProjectTodoSummary, ProjectServiceSummary } from "@/pages/projects/types";

export type ProjectSortField = "updated_at" | "created_at" | "name" | "lead_name" | "project_type" | "status";
export type ProjectSortDirection = "asc" | "desc";
export type ProjectsScope = "active" | "archived";

interface UseProjectsDataOptions {
  listPage: number;
  listPageSize: number;
  archivedPage: number;
  archivedPageSize: number;
  sortField: ProjectSortField;
  sortDirection: ProjectSortDirection;
  listFilters: ProjectsListFiltersState;
  archivedFilters: ProjectsArchivedFiltersState;
  onNetworkError?: (error: unknown) => void;
  onNetworkRecovery?: () => void;
}

interface FetchRange {
  from: number;
  to: number;
  includeCount?: boolean;
  filters?: Record<string, unknown>;
  forceNetwork?: boolean;
}

interface UseProjectsDataResult {
  listProjects: ProjectListItem[];
  archivedProjects: ProjectListItem[];
  listTotalCount: number;
  archivedTotalCount: number;
  initialLoading: boolean;
  listLoading: boolean;
  archivedLoading: boolean;
  refetch: () => Promise<void>;
  fetchProjectsData: (
    scope: ProjectsScope,
    range: FetchRange
  ) => Promise<{ projects: ProjectListItem[]; count: number; source: FetchSource }>;
  getCachedProjects: (scope: ProjectsScope) => ProjectListItem[];
  getCacheStatus: (scope: ProjectsScope) => CacheStatus;
}

type FetchSource = "cache" | "prefetch" | "network" | "fallback";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  lead_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  status_id: string | null;
  project_type_id: string | null;
  base_price: number | null;
  sort_order: number | null;
  session_count?: number | null;
  planned_session_count?: number | null;
  upcoming_session_count?: number | null;
  next_session_date?: string | null;
  todo_count?: number | null;
  completed_todo_count?: number | null;
  open_todos?: ProjectTodoSummary[] | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  lead?: ProjectListItem["lead"] | null;
  project_status?: ProjectListItem["project_status"] | null;
  project_type?: ProjectListItem["project_type"] | null;
  services?: ProjectServiceSummary[] | null;
};

type RpcProjectRow = ProjectRow & { total_count?: number | string | null };

type SessionSummaryRow = { project_id: string | null; status: string | null; session_date?: string | null };
type TodoRow = { id: string; project_id: string; is_completed: boolean; content: string | null };
type ServiceRow = { project_id: string; service: { id: string; name: string | null } | null };
type PaymentRow = { project_id: string; amount: number | null; status: string | null };
type LeadRow = { id: string; name: string; status: string | null; email: string | null; phone: string | null };
type ProjectStatusRow = { id: string; name: string | null; color: string | null; sort_order: number | null };
type ProjectTypeRow = { id: string; name: string | null };

interface PrefetchedProjectsPayload {
  ts?: number;
  value?: {
    items?: ProjectRow[];
    total?: number;
    ttl?: number;
  };
}

type ProjectsCacheEntry = {
  key: string | null;
  items: Map<number, ProjectListItem>;
  total: number | null;
  lastFetched: number;
};

type ProjectsCache = Record<ProjectsScope, ProjectsCacheEntry>;

const createCacheEntry = (): ProjectsCacheEntry => ({
  key: null,
  items: new Map<number, ProjectListItem>(),
  total: null,
  lastFetched: 0,
});

type InternalFetchResult = {
  projects: ProjectListItem[];
  total: number;
  source: FetchSource;
};

type CacheStatus = {
  total: number;
  cached: number;
  contiguous: number;
  hasFull: boolean;
  key: string | null;
  lastFetched: number;
};

const DEFAULT_PAGE_SIZE = 25;

const sumPaidAmount = (payments: PaymentRow[]) => {
  return payments.reduce<Record<string, number>>((acc, payment) => {
    const projectId = payment.project_id;
    if (!projectId) {
      return acc;
    }
    if (!acc[projectId]) acc[projectId] = 0;
    if (typeof payment.status === "string" && payment.status.toLowerCase() === "paid") {
      acc[projectId] += Number(payment.amount ?? 0);
    }
    return acc;
  }, {});
};

const buildTodoSummaries = (todos: TodoRow[]) => {
  const totals: Record<string, { total: number; completed: number }> = {};
  const open: Record<string, ProjectTodoSummary[]> = {};

  for (const todo of todos) {
    const stats = (totals[todo.project_id] ||= { total: 0, completed: 0 });
    stats.total += 1;
    if (todo.is_completed) {
      stats.completed += 1;
    } else {
      (open[todo.project_id] ||= []).push({ id: todo.id, content: todo.content ?? "" });
    }
  }

  return { totals, open };
};

const buildSessionSummaries = (
  sessions: SessionSummaryRow[]
) => {
  return sessions.reduce<Record<string, { total: number; planned: number; upcoming: number }>>((acc, session) => {
    if (!session.project_id) return acc;
    const bucket = (acc[session.project_id] ||= { total: 0, planned: 0, upcoming: 0 });
    bucket.total += 1;
    const status = (session.status || "").toLowerCase();
    if (status === "planned") bucket.planned += 1;
    if (status === "upcoming") bucket.upcoming += 1;
    return acc;
  }, {});
};

const mapServices = (rows: ServiceRow[]) => {
  return rows.reduce<Record<string, ProjectServiceSummary[]>>((acc, row) => {
    if (!row.project_id) return acc;
    if (!acc[row.project_id]) acc[row.project_id] = [];
    if (row.service?.id) {
      acc[row.project_id].push({ id: row.service.id, name: row.service.name ?? "" });
    }
    return acc;
  }, {});
};

const sortProjects = (
  projects: ProjectListItem[],
  sortField: ProjectSortField,
  direction: ProjectSortDirection
) => {
  const asc = direction === "asc";
  const sorted = [...projects];
  sorted.sort((a, b) => {
    let aValue: string | number | null = null;
    let bValue: string | number | null = null;

    switch (sortField) {
      case "name":
        aValue = a.name;
        bValue = b.name;
        break;
      case "lead_name":
        aValue = a.lead?.name ?? "";
        bValue = b.lead?.name ?? "";
        break;
      case "project_type":
        aValue = a.project_type?.name ?? "";
        bValue = b.project_type?.name ?? "";
        break;
      case "status":
        aValue = a.project_status?.name ?? "";
        bValue = b.project_status?.name ?? "";
        break;
      case "created_at":
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case "updated_at":
      default:
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return asc ? -1 : 1;
    if (bValue === null || bValue === undefined) return asc ? 1 : -1;
    return aValue < bValue ? (asc ? -1 : 1) : (asc ? 1 : -1);
  });
  return sorted;
};

const normalizeForCacheKey = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return [...value].map(normalizeForCacheKey).sort((a, b) => {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      if (aStr < bStr) return -1;
      if (aStr > bStr) return 1;
      return 0;
    });
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForCacheKey((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
};

const buildCacheKey = (
  scope: ProjectsScope,
  sortField: ProjectSortField,
  sortDirection: ProjectSortDirection,
  filters: Record<string, unknown> | undefined
) => {
  return JSON.stringify({
    scope,
    sortField,
    sortDirection,
    filters: normalizeForCacheKey(filters ?? {}),
  });
};

const hasCachedRange = (entry: ProjectsCacheEntry, range: FetchRange) => {
  if (!entry.key) return false;
  for (let index = range.from; index <= range.to; index += 1) {
    if (!entry.items.has(index)) {
      return false;
    }
  }
  if (range.includeCount && entry.total === null) {
    return false;
  }
  return true;
};

const getProjectsFromCache = (entry: ProjectsCacheEntry, range: FetchRange) => {
  const projects: ProjectListItem[] = [];
  for (let index = range.from; index <= range.to; index += 1) {
    const project = entry.items.get(index);
    if (project) {
      projects.push(project);
    }
  }
  return projects;
};

const storeInCache = (
  entry: ProjectsCacheEntry,
  cacheKey: string,
  range: FetchRange,
  projects: ProjectListItem[],
  count: number,
  updateTotal: boolean
) => {
  entry.key = cacheKey;
  projects.forEach((project, offset) => {
    entry.items.set(range.from + offset, project);
  });
  if (updateTotal) {
    entry.total = count;
    const total = Number.isFinite(count) ? Number(count) : null;
    if (total !== null) {
      for (const index of Array.from(entry.items.keys())) {
        if (index >= total) {
          entry.items.delete(index);
        }
      }
    }
  }
  entry.lastFetched = Date.now();
};

export function useProjectsData({
  listPage,
  listPageSize,
  archivedPage,
  archivedPageSize,
  sortField,
  sortDirection,
  listFilters,
  archivedFilters,
  onNetworkError,
  onNetworkRecovery,
}: UseProjectsDataOptions): UseProjectsDataResult {
  const [listProjects, setListProjects] = useState<ProjectListItem[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<ProjectListItem[]>([]);
  const [listTotalCount, setListTotalCount] = useState(0);
  const [archivedTotalCount, setArchivedTotalCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const firstLoadRef = useRef(true);
  const cacheRef = useRef<ProjectsCache>({
    active: createCacheEntry(),
    archived: createCacheEntry(),
  });
  const listLastFetchedPageRef = useRef(0);
  const archivedLastFetchedPageRef = useRef(0);

  const getCacheStatus = useCallback((scope: ProjectsScope): CacheStatus => {
    const entry = cacheRef.current[scope];
    const total = entry.total ?? entry.items.size;
    let contiguous = 0;
    while (entry.items.has(contiguous)) {
      contiguous += 1;
    }
    return {
      total,
      cached: entry.items.size,
      contiguous,
      hasFull: entry.total !== null && entry.items.size >= entry.total && entry.total !== 0,
      key: entry.key,
      lastFetched: entry.lastFetched,
    };
  }, []);

  const getCachedProjects = useCallback((scope: ProjectsScope) => {
    const entry = cacheRef.current[scope];
    return Array.from(entry.items.entries())
      .sort(([a], [b]) => a - b)
      .map(([, project]) => project);
  }, []);

  const listFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if (listFilters.stages.length) payload.status_ids = listFilters.stages;
    if (listFilters.types.length) payload.type_ids = listFilters.types;
    if (listFilters.services.length) payload.service_ids = listFilters.services;
    if (listFilters.sessionPresence !== "any") payload.session_presence = listFilters.sessionPresence;
    if (listFilters.progress !== "any") payload.progress = listFilters.progress;
    return payload;
  }, [listFilters]);

  const archivedFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if (archivedFilters.types.length) payload.type_ids = archivedFilters.types;
    if (archivedFilters.balancePreset !== "any") payload.balance_preset = archivedFilters.balancePreset;
    if (archivedFilters.balanceMin !== null) payload.balance_min = String(archivedFilters.balanceMin);
    if (archivedFilters.balanceMax !== null) payload.balance_max = String(archivedFilters.balanceMax);
    return payload;
  }, [archivedFilters]);

  const applyListFilters = useCallback(
    (project: ProjectListItem) => {
      const filters = listFilters;
      if (filters.types.length > 0 && (!project.project_type_id || !filters.types.includes(project.project_type_id))) {
        return false;
      }
      if (filters.stages.length > 0 && (!project.status_id || !filters.stages.includes(project.status_id))) {
        return false;
      }

      switch (filters.sessionPresence) {
        case "none":
          if ((project.session_count ?? 0) !== 0) return false;
          break;
        case "hasAny":
          if ((project.session_count ?? 0) === 0) return false;
          break;
        case "hasPlanned":
          if ((project.planned_session_count ?? 0) === 0) return false;
          break;
        case "hasUpcoming":
          if ((project.upcoming_session_count ?? 0) === 0) return false;
          break;
      }

      if (filters.progress !== "any") {
        const total = project.todo_count ?? 0;
        const completed = project.completed_todo_count ?? 0;
        if (filters.progress === "not_started" && !(total > 0 && completed === 0)) {
          return false;
        }
        if (filters.progress === "in_progress" && !(total > 0 && completed > 0 && completed < total)) {
          return false;
        }
        if (filters.progress === "completed" && !(total > 0 && completed === total)) {
          return false;
        }
      }

      if (filters.services.length > 0) {
        const serviceIds = (project.services ?? []).map((svc) => svc.id);
        if (!filters.services.some((id) => serviceIds.includes(id))) {
          return false;
        }
      }

      return true;
    },
    [listFilters]
  );

  const applyArchivedFilters = useCallback(
    (project: ProjectListItem) => {
      const filters = archivedFilters;
      if (filters.types.length > 0 && (!project.project_type_id || !filters.types.includes(project.project_type_id))) {
        return false;
      }

      const remaining = project.remaining_amount ?? 0;
      switch (filters.balancePreset) {
        case "zero":
          if (Math.abs(remaining) > 0.01) return false;
          break;
        case "due":
          if (!(remaining > 0.01)) return false;
          break;
        case "credit":
          if (!(remaining < -0.01)) return false;
          break;
      }

      if (filters.balanceMin !== null && remaining < filters.balanceMin) return false;
      if (filters.balanceMax !== null && remaining > filters.balanceMax) return false;

      return true;
    },
    [archivedFilters]
  );

  const mapRowToProject = useCallback((row: ProjectRow): ProjectListItem => ({
    id: row.id,
    name: row.name,
    description: row.description,
    lead_id: row.lead_id ?? "",
    user_id: row.user_id ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    status_id: row.status_id,
    project_type_id: row.project_type_id,
    base_price: row.base_price ?? null,
    sort_order: row.sort_order ?? null,
    lead: row.lead ?? null,
    project_status: row.project_status ?? null,
    project_type: row.project_type ?? null,
    session_count: row.session_count ?? 0,
    planned_session_count: row.planned_session_count ?? 0,
    upcoming_session_count: row.upcoming_session_count ?? 0,
    next_session_date: row.next_session_date ?? null,
    todo_count: row.todo_count ?? 0,
    completed_todo_count: row.completed_todo_count ?? 0,
    open_todos: Array.isArray(row.open_todos) ? row.open_todos : [],
    paid_amount: row.paid_amount ?? 0,
    remaining_amount: row.remaining_amount ?? 0,
    services: Array.isArray(row.services) ? row.services : [],
  }), []);

  const fetchProjectsData = useCallback(
    async (scope: ProjectsScope, range: FetchRange) => {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("No active organization found");
      }

      const requestedLength = Math.max(range.to - range.from + 1, 1);
      const page = Math.floor(range.from / requestedLength) + 1;
      const filtersPayload = range.filters ?? (scope === "archived" ? archivedFilterPayload : listFilterPayload);
      const cacheKey = buildCacheKey(scope, sortField, sortDirection, filtersPayload);
      const cacheEntry = cacheRef.current[scope];

      if (cacheEntry.key !== cacheKey) {
        cacheEntry.key = cacheKey;
        cacheEntry.items.clear();
        cacheEntry.total = null;
        cacheEntry.lastFetched = 0;
      }

      const timer = startTimer("Projects.fetchPage", {
        scope,
        page,
        pageSize: requestedLength,
        sortField,
        sortDirection,
        force: range.forceNetwork ? "network" : "auto",
      });

      const finalize = (result: { projects: ProjectListItem[]; count: number; source: FetchSource }) => {
        timer.end({ rows: result.projects.length, total: result.count, source: result.source });
        return result;
      };

      if (!range.forceNetwork && hasCachedRange(cacheEntry, range)) {
        const projects = getProjectsFromCache(cacheEntry, range);
        const count = range.includeCount ? cacheEntry.total ?? projects.length : projects.length;
        cacheEntry.lastFetched = Date.now();
        return finalize({ projects, count, source: "cache" });
      }

      if (!range.forceNetwork) {
        try {
          const isDefaultList =
            scope === "active" &&
            page === 1 &&
            requestedLength === (DEFAULT_PAGE_SIZE || 25) &&
            (!filtersPayload || Object.keys(filtersPayload).length === 0) &&
            sortField === "created_at" &&
            sortDirection === "desc";
          if (isDefaultList && typeof window !== "undefined") {
            const raw = localStorage.getItem(`prefetch:projects:first:${organizationId}:active`);
            if (raw) {
              const parsed = JSON.parse(raw) as PrefetchedProjectsPayload;
              const ts = parsed?.ts ?? 0;
              const ttl = parsed?.value?.ttl ?? 60_000;
              if (Date.now() - ts < ttl) {
                const items = parsed.value?.items;
                const rows: ProjectRow[] = Array.isArray(items) ? items : [];
                const total = rows.length ? Number(parsed.value?.total ?? rows.length) : 0;
                const projects = rows.map(mapRowToProject);
                storeInCache(cacheEntry, cacheKey, range, projects, total, true);
                cacheEntry.lastFetched = Date.now();
                return finalize({
                  projects,
                  count: range.includeCount ? total : projects.length,
                  source: "prefetch",
                });
              }
            }
          }
        } catch {
          // Ignore localStorage or JSON errors and fall back to network fetch.
        }
      }

      const fetchViaRpc = async (): Promise<InternalFetchResult> => {
        const tRpc = startTimer("Projects.rpc.projects_filter_page");
        const { data, error } = await supabase.rpc("projects_filter_page", {
          org: organizationId,
          p_page: page,
          p_size: requestedLength,
          p_sort_field: sortField,
          p_sort_dir: sortDirection,
          p_scope: scope,
          p_filters: filtersPayload,
        });
        if (error) {
          tRpc.end({ error: String(error?.message || error) });
          throw error;
        }
        const rows: RpcProjectRow[] = Array.isArray(data) ? data : [];
        const total = rows.length ? Number(rows[0]?.total_count ?? rows.length) : 0;
        const projects = rows.map(mapRowToProject);
        tRpc.end({ rows: rows.length, total });
        return { projects, total, source: "network" };
      };

      const fetchViaFallback = async (): Promise<InternalFetchResult> => {
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("*")
          .eq("organization_id", organizationId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (projectsError) throw projectsError;

        const projectRows: ProjectRow[] = Array.isArray(projectsData) ? projectsData : [];
        const projectIds = projectRows.map((project) => project.id);
        const leadIds = projectRows
          .map((project) => project.lead_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0);

        const [
          sessionsData,
          todosData,
          servicesData,
          paymentsData,
          leadsData,
          projectStatusesData,
          projectTypesData,
        ] = await Promise.all([
          projectIds.length
            ? supabase.from("sessions").select("project_id, status").in("project_id", projectIds)
            : Promise.resolve<{ data: SessionSummaryRow[]; error: null }>({ data: [], error: null }),
          projectIds.length
            ? supabase.from("todos").select("id, project_id, is_completed, content").in("project_id", projectIds)
            : Promise.resolve<{ data: TodoRow[]; error: null }>({ data: [], error: null }),
          projectIds.length
            ? supabase.from("project_services").select(`project_id, service:services(id, name)`).in("project_id", projectIds)
            : Promise.resolve<{ data: ServiceRow[]; error: null }>({ data: [], error: null }),
          projectIds.length
            ? supabase
                .from("payments")
                .select("project_id, amount, status")
                .in("project_id", projectIds)
                .eq("entry_kind", "recorded")
            : Promise.resolve<{ data: PaymentRow[]; error: null }>({ data: [], error: null }),
          leadIds.length
            ? supabase.from("leads").select("id, name, status, email, phone").in("id", leadIds)
            : Promise.resolve<{ data: LeadRow[]; error: null }>({ data: [], error: null }),
          supabase
            .from("project_statuses")
            .select("id, name, color, sort_order")
            .eq("organization_id", organizationId),
          supabase.from("project_types").select("id, name").eq("organization_id", organizationId),
        ]);

        if (sessionsData.error) throw sessionsData.error;
        if (todosData.error) throw todosData.error;
        if (servicesData.error) throw servicesData.error;
        if (paymentsData.error) throw paymentsData.error;
        if (leadsData.error) throw leadsData.error;
        if (projectStatusesData.error) throw projectStatusesData.error;
        if (projectTypesData.error) throw projectTypesData.error;

        const sessionRows: SessionSummaryRow[] = Array.isArray(sessionsData.data) ? sessionsData.data : [];
        const todoRows: TodoRow[] = Array.isArray(todosData.data) ? todosData.data : [];
        const paymentRows: PaymentRow[] = Array.isArray(paymentsData.data) ? paymentsData.data : [];
        const serviceRows: ServiceRow[] = Array.isArray(servicesData.data) ? servicesData.data : [];
        const leadRows: LeadRow[] = Array.isArray(leadsData.data) ? leadsData.data : [];
        const statusRows: ProjectStatusRow[] = Array.isArray(projectStatusesData.data)
          ? projectStatusesData.data
          : [];
        const typeRows: ProjectTypeRow[] = Array.isArray(projectTypesData.data) ? projectTypesData.data : [];

        const sessionCounts = buildSessionSummaries(sessionRows);
        const { totals: todoTotals, open: openTodos } = buildTodoSummaries(todoRows);
        const paymentTotals = sumPaidAmount(paymentRows);
        const servicesMap = mapServices(serviceRows);
        const leadMap = leadRows.reduce<Record<string, ProjectListItem["lead"]>>((acc, lead) => {
          acc[lead.id] = {
            id: lead.id,
            name: lead.name,
            status: lead.status ?? "",
            email: lead.email,
            phone: lead.phone,
          };
          return acc;
        }, {});
        const statusMap = statusRows.reduce<Record<string, ProjectListItem["project_status"]>>((acc, status) => {
          acc[status.id] = {
            id: status.id,
            name: status.name ?? "",
            color: status.color ?? "",
            sort_order: status.sort_order ?? undefined,
          };
          return acc;
        }, {});
        const typeMap = typeRows.reduce<Record<string, ProjectListItem["project_type"]>>((acc, type) => {
          acc[type.id] = { id: type.id, name: type.name ?? "" };
          return acc;
        }, {});

        const archivedStatus = statusRows.find(
          (status) => typeof status.name === "string" && status.name.toLowerCase() === "archived"
        );
        const archivedStatusId = archivedStatus?.id ?? null;

        const enriched = projectRows.map((project) => {
          const paidAmount = paymentTotals[project.id] ?? 0;
          const sessionSummary = sessionCounts[project.id] ?? { total: 0, planned: 0, upcoming: 0 };
          const todoSummary = todoTotals[project.id] ?? { total: 0, completed: 0 };
          const enrichedProject: ProjectListItem = {
            id: project.id,
            name: project.name,
            description: project.description,
            lead_id: project.lead_id ?? "",
            user_id: project.user_id ?? "",
            created_at: project.created_at,
            updated_at: project.updated_at,
            status_id: project.status_id,
            project_type_id: project.project_type_id,
            base_price: project.base_price ?? null,
            sort_order: project.sort_order ?? null,
            lead: project.lead_id ? leadMap[project.lead_id] ?? null : null,
            project_status: project.status_id ? statusMap[project.status_id] ?? null : null,
            project_type: project.project_type_id ? typeMap[project.project_type_id] ?? null : null,
            session_count: sessionSummary.total,
            planned_session_count: sessionSummary.planned,
            upcoming_session_count: sessionSummary.upcoming,
            next_session_date: null,
            todo_count: todoSummary.total,
            completed_todo_count: todoSummary.completed,
            open_todos: openTodos[project.id] ?? [],
            paid_amount: paidAmount,
            remaining_amount: Number(project.base_price ?? 0) - paidAmount,
            services: servicesMap[project.id] ?? [],
          };
          return enrichedProject;
        });

        const partitioned = enriched.reduce<{
          active: ProjectListItem[];
          archived: ProjectListItem[];
        }>(
          (acc, project) => {
            if (project.status_id && project.status_id === archivedStatusId) {
              acc.archived.push(project);
            } else {
              acc.active.push(project);
            }
            return acc;
          },
          { active: [], archived: [] }
        );

        const pool = scope === "archived" ? partitioned.archived : partitioned.active;
        const filtered = scope === "archived" ? pool.filter(applyArchivedFilters) : pool.filter(applyListFilters);

        const sorted = sortProjects(filtered, sortField, sortDirection);
        const total = sorted.length;
        const slice = sorted.slice(range.from, range.to + 1);
        return { projects: slice, total, source: "fallback" };
      };

      try {
        const result = await fetchViaRpc();
        const updateTotal = range.includeCount === true || cacheEntry.total === null;
        storeInCache(cacheEntry, cacheKey, range, result.projects, result.total, updateTotal);
        return finalize({
          projects: result.projects,
          count: range.includeCount ? result.total : result.projects.length,
          source: result.source,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logInfo("Projects.rpc.fallback", { reason });
        const fallbackTimer = startTimer("Projects.fallback.query");
        const fallbackResult = await fetchViaFallback();
        fallbackTimer.end({ rows: fallbackResult.projects.length, total: fallbackResult.total });
        const updateTotal = range.includeCount === true || cacheEntry.total === null;
        storeInCache(cacheEntry, cacheKey, range, fallbackResult.projects, fallbackResult.total, updateTotal);
        return finalize({
          projects: fallbackResult.projects,
          count: range.includeCount ? fallbackResult.total : fallbackResult.projects.length,
          source: fallbackResult.source,
        });
      }
    },
    [
      archivedFilterPayload,
      applyArchivedFilters,
      applyListFilters,
      listFilterPayload,
      mapRowToProject,
      sortDirection,
      sortField,
    ]
  );

  const mergeProjects = useCallback((prev: ProjectListItem[], next: ProjectListItem[]) => {
    if (prev.length === 0) return next;
    if (next.length === 0) return prev;
    const map = new Map(prev.map((project) => [project.id, project]));
    const merged = [...prev];
    for (const project of next) {
      const existing = map.get(project.id);
      if (existing) {
        const index = merged.findIndex((row) => row.id === project.id);
        if (index !== -1) {
          merged[index] = project;
        }
      } else {
        merged.push(project);
        map.set(project.id, project);
      }
    }
    return merged;
  }, []);

  const fetchList = useCallback(async (force = false) => {
    const first = firstLoadRef.current;
    try {
      if (first) setInitialLoading(true);
      setListLoading(true);
      const pageSize = listPageSize || DEFAULT_PAGE_SIZE;
      const from = (listPage - 1) * pageSize;
      const to = from + pageSize - 1;
      const t = startTimer('Projects.listLoad', { page: listPage, pageSize });
      const { projects, count } = await fetchProjectsData("active", {
        from,
        to,
        includeCount: true,
        forceNetwork: force,
      });
      const shouldAppend = !force && listPage > listLastFetchedPageRef.current;
      setListProjects((prev) => {
        if (!shouldAppend) {
          return projects;
        }
        return mergeProjects(prev, projects);
      });
      setListTotalCount(count);
      listLastFetchedPageRef.current = listPage;
      t.end({ rows: projects.length, total: count });
      onNetworkRecovery?.();
    } catch (error) {
      // Swallow errors here to avoid unhandled promise rejections that spam the console.
      // Pages can decide how to surface errors (e.g., board view toast).
      console.error('useProjectsData.listLoad error', error);
      if (isNetworkError(error)) {
        onNetworkError?.(error);
      }
      // Preserve previous data; do not clear UI abruptly.
    } finally {
      setListLoading(false);
      if (first) {
        firstLoadRef.current = false;
        setInitialLoading(false);
      }
    }
  }, [fetchProjectsData, listPage, listPageSize, mergeProjects, onNetworkError, onNetworkRecovery]);

  const fetchArchived = useCallback(async (force = false) => {
    setArchivedLoading(true);
    try {
      const pageSize = archivedPageSize || DEFAULT_PAGE_SIZE;
      const from = (archivedPage - 1) * pageSize;
      const to = from + pageSize - 1;
      const t = startTimer('Projects.archivedLoad', { page: archivedPage, pageSize });
      const { projects, count } = await fetchProjectsData("archived", {
        from,
        to,
        includeCount: true,
        forceNetwork: force,
      });
      const shouldAppend = !force && archivedPage > archivedLastFetchedPageRef.current;
      setArchivedProjects((prev) => {
        if (!shouldAppend) {
          return projects;
        }
        return mergeProjects(prev, projects);
      });
      setArchivedTotalCount(count);
      archivedLastFetchedPageRef.current = archivedPage;
      t.end({ rows: projects.length, total: count });
      onNetworkRecovery?.();
    } catch (error) {
      console.error('useProjectsData.archivedLoad error', error);
      if (isNetworkError(error)) {
        onNetworkError?.(error);
      }
    } finally {
      setArchivedLoading(false);
    }
  }, [archivedPage, archivedPageSize, fetchProjectsData, mergeProjects, onNetworkError, onNetworkRecovery]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  const refetch = useCallback(async () => {
    const activePageSize = listPageSize || DEFAULT_PAGE_SIZE;
    const archivedPageSizeFinal = archivedPageSize || DEFAULT_PAGE_SIZE;
    setListLoading(true);
    setArchivedLoading(true);
    try {
      const [active, archivedResult] = await Promise.all([
        fetchProjectsData("active", {
          from: 0,
          to: activePageSize - 1,
          includeCount: true,
          forceNetwork: true,
        }),
        fetchProjectsData("archived", {
          from: 0,
          to: archivedPageSizeFinal - 1,
          includeCount: true,
          forceNetwork: true,
        }),
      ]);

      setListProjects(active.projects);
      setListTotalCount(active.count);
      listLastFetchedPageRef.current = 1;

      setArchivedProjects(archivedResult.projects);
      setArchivedTotalCount(archivedResult.count);
      archivedLastFetchedPageRef.current = 1;
    } finally {
      setListLoading(false);
      setArchivedLoading(false);
    }
  }, [archivedPageSize, fetchProjectsData, listPageSize]);

  return {
    listProjects,
    archivedProjects,
    listTotalCount,
    archivedTotalCount,
    initialLoading,
    listLoading,
    archivedLoading,
    refetch,
    fetchProjectsData,
    getCachedProjects,
    getCacheStatus,
  };
}
