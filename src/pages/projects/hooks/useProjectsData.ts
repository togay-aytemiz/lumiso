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
  ) => Promise<{ projects: ProjectListItem[]; count: number }>;
}

const DEFAULT_PAGE_SIZE = 25;

const sumPaidAmount = (payments: { project_id: string; amount: number; status: string }[]) => {
  return payments.reduce<Record<string, number>>((acc, payment) => {
    if (!acc[payment.project_id]) acc[payment.project_id] = 0;
    if (typeof payment.status === "string" && payment.status.toLowerCase() === "paid") {
      acc[payment.project_id] += Number(payment.amount || 0);
    }
    return acc;
  }, {});
};

const buildTodoSummaries = (todos: { id: string; project_id: string; is_completed: boolean; content: string }[]) => {
  const totals: Record<string, { total: number; completed: number }> = {};
  const open: Record<string, ProjectTodoSummary[]> = {};

  for (const todo of todos) {
    const stats = (totals[todo.project_id] ||= { total: 0, completed: 0 });
    stats.total += 1;
    if (todo.is_completed) {
      stats.completed += 1;
    } else {
      (open[todo.project_id] ||= []).push({ id: todo.id, content: todo.content });
    }
  }

  return { totals, open };
};

const buildSessionSummaries = (
  sessions: { project_id: string | null; status: string | null; session_date: string | null }[]
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

const mapServices = (rows: { project_id: string; service?: { id: string; name: string } | null }[]) => {
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

  const mapRowToProject = useCallback((row: any): ProjectListItem => ({
    id: row.id,
    name: row.name,
    description: row.description,
    lead_id: row.lead_id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status_id: row.status_id,
    project_type_id: row.project_type_id,
    base_price: row.base_price,
    sort_order: row.sort_order,
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

      const pageSize = Math.max(range.to - range.from + 1, 1);
      const page = Math.floor(range.from / pageSize) + 1;
      const filtersPayload = range.filters ?? (scope === "archived" ? archivedFilterPayload : listFilterPayload);
      const t = startTimer('Projects.fetchPage', {
        scope,
        page,
        pageSize,
        sortField,
        sortDirection,
      });

      const fetchViaRpc = async () => {
        const tRpc = startTimer('Projects.rpc.projects_filter_page');
        const { data, error } = await supabase.rpc("projects_filter_page", {
          org: organizationId,
          p_page: page,
          p_size: pageSize,
          p_sort_field: sortField,
          p_sort_dir: sortDirection,
          p_scope: scope,
          p_filters: filtersPayload,
        });
        if (error) {
          tRpc.end({ error: String(error?.message || error) });
          throw error;
        }
        const rows = (data as any[]) ?? [];
        const total = rows.length ? Number(rows[0].total_count ?? 0) : 0;
        const projects = rows.map(mapRowToProject);
        tRpc.end({ rows: rows.length, total });
        t.end({ rows: projects.length, total });
        return { projects, count: range.includeCount ? total : projects.length };
      };

      const fetchViaFallback = async () => {
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("*")
          .eq("organization_id", organizationId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (projectsError) throw projectsError;

        const projectIds = (projectsData ?? []).map((project) => project.id);
        const leadIds = (projectsData ?? []).map((project) => project.lead_id).filter(Boolean);

        const [sessionsData, todosData, servicesData, paymentsData, leadsData, projectStatusesData, projectTypesData] = await Promise.all([
          projectIds.length
            ? supabase
                .from("sessions")
                .select("project_id, status")
                .in("project_id", projectIds)
            : Promise.resolve({ data: [] }),
          projectIds.length
            ? supabase
                .from("todos")
                .select("id, project_id, is_completed, content")
                .in("project_id", projectIds)
            : Promise.resolve({ data: [] }),
          projectIds.length
            ? supabase
                .from("project_services")
                .select(`project_id, service:services(id, name)`)
                .in("project_id", projectIds)
            : Promise.resolve({ data: [] }),
          projectIds.length
            ? supabase
                .from("payments")
                .select("project_id, amount, status")
                .in("project_id", projectIds)
            : Promise.resolve({ data: [] }),
          leadIds.length
            ? supabase
                .from("leads")
                .select("id, name, status, email, phone")
                .in("id", leadIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("project_statuses")
            .select("id, name, color, sort_order")
            .eq("organization_id", organizationId),
          supabase
            .from("project_types")
            .select("id, name")
            .eq("organization_id", organizationId),
        ]);

        if (sessionsData.error) throw sessionsData.error;
        if (todosData.error) throw todosData.error;
        if (servicesData.error) throw servicesData.error;
        if (paymentsData.error) throw paymentsData.error;
        if (leadsData.error) throw leadsData.error;
        if (projectStatusesData.error) throw projectStatusesData.error;
        if (projectTypesData.error) throw projectTypesData.error;

        const sessionCounts = buildSessionSummaries((sessionsData.data ?? []) as any);
        const { totals: todoTotals, open: openTodos } = buildTodoSummaries((todosData.data ?? []) as any);
        const paymentTotals = sumPaidAmount((paymentsData.data ?? []) as any);
        const servicesMap = mapServices((servicesData.data ?? []) as any);
        const leadMap = (leadsData.data ?? []).reduce<Record<string, ProjectListItem["lead"]>>((acc, lead: any) => {
          acc[lead.id] = {
            id: lead.id,
            name: lead.name,
            status: lead.status,
            email: lead.email,
            phone: lead.phone,
          };
          return acc;
        }, {});
        const statusMap = (projectStatusesData.data ?? []).reduce<Record<string, ProjectListItem["project_status"]>>((acc, status: any) => {
          acc[status.id] = {
            id: status.id,
            name: status.name,
            color: status.color,
            sort_order: status.sort_order,
          };
          return acc;
        }, {});
        const typeMap = (projectTypesData.data ?? []).reduce<Record<string, ProjectListItem["project_type"]>>((acc, type: any) => {
          acc[type.id] = { id: type.id, name: type.name };
          return acc;
        }, {});

        const archivedStatus = (projectStatusesData.data ?? []).find(
          (status: any) => typeof status.name === "string" && status.name.toLowerCase() === "archived"
        );
        const archivedStatusId = archivedStatus?.id ?? null;

        const enriched = (projectsData ?? []).map((project: any) => {
          const paidAmount = paymentTotals[project.id] ?? 0;
          const sessionSummary = sessionCounts[project.id] ?? { total: 0, planned: 0, upcoming: 0 };
          const todoSummary = todoTotals[project.id] ?? { total: 0, completed: 0 };
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            lead_id: project.lead_id,
            user_id: project.user_id,
            created_at: project.created_at,
            updated_at: project.updated_at,
            status_id: project.status_id,
            project_type_id: project.project_type_id,
            base_price: project.base_price,
            sort_order: project.sort_order,
            lead: leadMap[project.lead_id] ?? null,
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
            remaining_amount: Number(project.base_price || 0) - paidAmount,
            services: servicesMap[project.id] ?? [],
          } as ProjectListItem;
        });

        const partitioned = enriched.reduce<{
          active: ProjectListItem[];
          archived: ProjectListItem[];
        }>((acc, project) => {
          if (project.status_id && project.status_id === archivedStatusId) {
            acc.archived.push(project);
          } else {
            acc.active.push(project);
          }
          return acc;
        }, { active: [], archived: [] });

        const pool = scope === "archived" ? partitioned.archived : partitioned.active;
        const filtered = scope === "archived"
          ? pool.filter(applyArchivedFilters)
          : pool.filter(applyListFilters);

        const sorted = sortProjects(filtered, sortField, sortDirection);
        const total = sorted.length;
        const slice = sorted.slice(range.from, range.to + 1);
        return { projects: slice, count: range.includeCount ? total : slice.length };
      };

      try {
        return await fetchViaRpc();
      } catch (error) {
        logInfo("Projects.rpc.fallback", { reason: (error as any)?.message || String(error) });
        const tFb = startTimer('Projects.fallback.query');
        const res = await fetchViaFallback();
        tFb.end({ rows: res.projects.length, count: res.count });
        t.end({ rows: res.projects.length, total: res.count });
        return res;
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

  const fetchList = useCallback(async () => {
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
      });
      setListProjects(projects);
      setListTotalCount(count);
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
  }, [fetchProjectsData, listPage, listPageSize, onNetworkError, onNetworkRecovery]);

  const fetchArchived = useCallback(async () => {
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
      });
      setArchivedProjects(projects);
      setArchivedTotalCount(count);
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
  }, [archivedPage, archivedPageSize, fetchProjectsData, onNetworkError, onNetworkRecovery]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchList(), fetchArchived()]);
  }, [fetchArchived, fetchList]);

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
  };
}
