import { supabase } from "@/integrations/supabase/client";
import { computeServiceTotals } from "@/lib/payments/servicePricing";
import {
  DEFAULT_ORGANIZATION_TAX_PROFILE,
  fetchOrganizationSettingsWithCache,
  type OrganizationTaxProfile
} from "@/lib/organizationSettingsCache";
import type { Database } from "@/integrations/supabase/types";

export interface LeadDetailRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string | null;
  status_id: string | null;
  created_at: string;
  updated_at: string | null;
  user_id: string | null;
  lead_statuses?: {
    id: string;
    name: string;
    color: string | null;
    is_system_final: boolean | null;
  } | null;
}

export interface LeadSessionRecord {
  id: string;
  lead_id: string;
  project_id: string | null;
  session_date: string | null;
  session_time: string | null;
  session_name?: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  project_name?: string | null;
  projects?: {
    id: string;
    name: string | null;
    status_id: string | null;
    project_types?: {
      name: string | null;
    } | null;
  } | null;
}

export interface ProjectSummary {
  count: number;
  latestUpdate: string | null;
}

export interface AggregatedPaymentSummary {
  totalPaid: number;
  total: number;
  remaining: number;
  currency: string;
}

export interface LeadProjectSummaryPayload {
  hasProjects: boolean;
  summary: ProjectSummary;
  payments: AggregatedPaymentSummary;
}

type ProjectStatusRow = Database["public"]["Tables"]["project_statuses"]["Row"];

const archivedStatusCache = new Map<string, string[]>();
const vatPreferenceCache = new Map<string, boolean>();

async function resolveVatEnabled(organizationId?: string | null): Promise<boolean> {
  if (!organizationId) {
    return true;
  }

  if (vatPreferenceCache.has(organizationId)) {
    return vatPreferenceCache.get(organizationId)!;
  }

  try {
    const settings = await fetchOrganizationSettingsWithCache(organizationId);
    const taxProfile = (settings?.tax_profile ?? null) as OrganizationTaxProfile | null;
    const normalizedEntity =
      taxProfile?.legalEntityType ?? DEFAULT_ORGANIZATION_TAX_PROFILE.legalEntityType;
    const vatExempt = taxProfile?.vatExempt ?? normalizedEntity === "freelance";
    const vatEnabled = !vatExempt;
    vatPreferenceCache.set(organizationId, vatEnabled);
    return vatEnabled;
  } catch (error) {
    console.error("Error resolving VAT preference for organization:", error);
    vatPreferenceCache.set(organizationId, true);
    return true;
  }
}

function normalizeStatusName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

async function getArchivedProjectStatusIds(organizationId: string): Promise<string[]> {
  if (archivedStatusCache.has(organizationId)) {
    return archivedStatusCache.get(organizationId)!;
  }

  const { data, error } = await supabase
    .from<ProjectStatusRow>("project_statuses")
    .select("id, lifecycle, name")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Error fetching archived project statuses:", error);
    archivedStatusCache.set(organizationId, []);
    return [];
  }

  const archivedStatusIds = (data ?? [])
    .filter((status) => {
      const lifecycle = normalizeStatusName(status.lifecycle);
      if (lifecycle === "archived") {
        return true;
      }
      const name = normalizeStatusName(status.name);
      return name === "archived";
    })
    .map((status) => status.id);

  archivedStatusCache.set(organizationId, archivedStatusIds);
  return archivedStatusIds;
}

export async function fetchLeadById(leadId: string): Promise<LeadDetailRecord | null> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
      *,
      lead_statuses(id, name, color, is_system_final)
    `
    )
    .eq("id", leadId)
    .maybeSingle();

  if (error) throw error;
  return (data as LeadDetailRecord | null) ?? null;
}

export async function fetchLeadSessions(
  leadId: string,
  organizationId?: string | null
): Promise<LeadSessionRecord[]> {
  const [{ data, error }, archivedStatusIds] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        `
        *,
        projects:project_id (
          id,
          name,
          status_id,
          project_types ( name )
        )
      `
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
    organizationId ? getArchivedProjectStatusIds(organizationId) : Promise.resolve([])
  ]);

  if (error) throw error;

  const rows = ((data || []) as LeadSessionRecord[]).map((session) => ({
    ...session,
    project_name: session.projects?.name ?? null
  }));

  if (!archivedStatusIds || archivedStatusIds.length === 0) {
    return rows;
  }

  const archivedLookup = new Set(archivedStatusIds);

  return rows.filter((session) => {
    if (!session.project_id) return true;
    const projectStatusId = session.projects?.status_id;
    if (!projectStatusId) return true;
    return !archivedLookup.has(projectStatusId);
  });
}

export async function fetchLeadProjectSummary(
  leadId: string,
  organizationId: string
): Promise<LeadProjectSummaryPayload> {
  const [projectsResult, archivedStatusIds, vatEnabled] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `
        id,
        updated_at,
        base_price,
        status_id,
        project_services (
          billing_type,
          quantity,
          unit_price_override,
          vat_rate_override,
          vat_mode_override,
          services (
            selling_price,
            price,
            vat_rate,
            price_includes_vat
          )
        )
      `
      )
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId),
    getArchivedProjectStatusIds(organizationId),
    resolveVatEnabled(organizationId)
  ]);

  if (projectsResult.error) throw projectsResult.error;

  const projects =
    (projectsResult.data || []) as Array<{
      id: string;
      updated_at: string | null;
      base_price: number | null;
      status_id: string | null;
      project_services?:
        | Array<{
            billing_type?: "included" | "extra" | null;
            quantity?: number | null;
            unit_price_override?: number | null;
            vat_rate_override?: number | null;
            vat_mode_override?: "inclusive" | "exclusive" | null;
            services?:
              | {
                  selling_price?: number | null;
                  price?: number | null;
                  vat_rate?: number | null;
                  price_includes_vat?: boolean | null;
                }
              | null;
          }>
        | null;
    }>;

  const archivedLookup = new Set(archivedStatusIds ?? []);
  const visibleProjects =
    archivedLookup.size > 0
      ? projects.filter((project) => {
          if (!project.status_id) return true;
          return !archivedLookup.has(project.status_id);
        })
      : projects;

  const projectIds = visibleProjects.map((project) => project.id);

  const latestProjectUpdate = visibleProjects.reduce<string | null>((latest, project) => {
    if (!project.updated_at) return latest;
    if (!latest) return project.updated_at;
    return new Date(project.updated_at).getTime() > new Date(latest).getTime()
      ? project.updated_at
      : latest;
  }, null);

  let latestTodoUpdate: string | null = null;
  if (projectIds.length > 0) {
    try {
      const { data: latestTodoRow, error: todosError } = await supabase
        .from("todos")
        .select("updated_at, created_at")
        .in("project_id", projectIds)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (todosError && todosError.code !== "PGRST116") {
        throw todosError;
      }

      latestTodoUpdate = latestTodoRow?.updated_at ?? latestTodoRow?.created_at ?? null;
    } catch (error) {
      console.error("Error fetching latest todo update for lead summary:", error);
    }
  }

  const latestUpdate = [latestProjectUpdate, latestTodoUpdate].reduce<string | null>((current, candidate) => {
    if (!candidate) return current;
    if (!current) return candidate;
    return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
  }, null);

  let totalBooked = 0;
  visibleProjects.forEach((project) => {
    const basePrice = Number(project.base_price) || 0;
    const servicesTotal = (project.project_services || []).reduce((sum, entry) => {
      const billingType = (entry?.billing_type ?? "included").toString().trim().toLowerCase();
      if (billingType !== "extra") {
        return sum;
      }
      const service = entry?.services;
      if (!service) return sum;
      const pricing = computeServiceTotals({
        unitPrice: entry?.unit_price_override ?? service.selling_price ?? service.price ?? null,
        quantity: entry?.quantity ?? 1,
        vatRate: vatEnabled ? entry?.vat_rate_override ?? service.vat_rate ?? null : 0,
        vatMode: vatEnabled
          ? entry?.vat_mode_override ??
            (service.price_includes_vat === false ? "exclusive" : "inclusive")
          : "inclusive",
      });
      return sum + pricing.gross;
    }, 0);
    totalBooked += basePrice + servicesTotal;
  });

  let totalPaid = 0;
  if (visibleProjects.length > 0) {
    try {
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("project_id, amount, status")
        .in("project_id", projectIds)
        .eq("entry_kind", "recorded");

      if (paymentsError) throw paymentsError;

      (payments || []).forEach((payment) => {
        const status = (payment?.status || "").toString().trim().toLowerCase();
        if (status !== "paid") return;
        const amount = Number(payment?.amount) || 0;
        if (!Number.isFinite(amount)) return;
        totalPaid += amount;
      });
    } catch (error) {
      console.error("Error fetching payments for lead summary:", error);
    }
  }

  const remaining = Math.max(0, totalBooked - totalPaid);

  return {
    hasProjects: visibleProjects.length > 0,
    summary: {
      count: visibleProjects.length,
      latestUpdate
    },
    payments: {
      totalPaid,
      total: totalBooked,
      remaining,
      currency: "TRY"
    }
  };
}

export async function fetchLatestLeadActivity(leadId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("activities")
    .select("updated_at, created_at")
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const latest = data && data.length > 0 ? data[0] : null;
  return latest?.updated_at || latest?.created_at || null;
}
