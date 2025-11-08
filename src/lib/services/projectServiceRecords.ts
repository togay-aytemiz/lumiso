import { supabase } from "@/integrations/supabase/client";

type VatModeValue = "inclusive" | "exclusive";

interface ProjectServiceJoin {
  id: string;
  project_id: string;
  billing_type: "included" | "extra";
  quantity: number | null;
  unit_cost_override: number | null;
  unit_price_override: number | null;
  vat_mode_override: VatModeValue | null;
  vat_rate_override: number | null;
  services: {
    id: string;
    name: string;
    extra: boolean | null;
    selling_price?: number | null;
    price?: number | null;
    vat_rate?: number | null;
    price_includes_vat?: boolean | null;
    cost_price?: number | null;
    category?: string | null;
    service_type?: "coverage" | "deliverable" | null;
  } | null;
}

export interface ProjectServiceRecord {
  projectServiceId: string;
  billingType: "included" | "extra";
  quantity: number;
  overrides: {
    unitCost: number | null;
    unitPrice: number | null;
    vatMode: VatModeValue | null;
    vatRate: number | null;
  };
  service: {
    id: string;
    name: string;
    extra: boolean;
    selling_price?: number | null;
    price?: number | null;
    vat_rate?: number | null;
    price_includes_vat?: boolean | null;
    cost_price?: number | null;
    category?: string | null;
    service_type?: "coverage" | "deliverable" | null;
  };
}

const mapRecord = (entry: ProjectServiceJoin): ProjectServiceRecord | null => {
  const service = entry.services;
  if (!service) return null;

  const quantity = Math.max(1, Number(entry.quantity ?? 1));
  const overrides = {
    unitCost: entry.unit_cost_override ?? null,
    unitPrice: entry.unit_price_override ?? null,
    vatMode: entry.vat_mode_override ?? null,
    vatRate: entry.vat_rate_override ?? null
  };

  const resolvedUnitCost = overrides.unitCost ?? (service.cost_price ?? null);
  const resolvedUnitPrice = overrides.unitPrice ?? service.selling_price ?? service.price ?? null;
  const resolvedVatRate = overrides.vatRate ?? (service.vat_rate ?? null);
  const resolvedVatMode: VatModeValue =
    overrides.vatMode ?? (service.price_includes_vat === false ? "exclusive" : "inclusive");

  return {
    projectServiceId: entry.id,
    billingType: entry.billing_type,
    quantity,
    overrides,
    service: {
      id: service.id,
      name: service.name,
      extra: Boolean(service.extra),
      selling_price: resolvedUnitPrice,
      price: resolvedUnitPrice,
      vat_rate: resolvedVatRate ?? undefined,
      price_includes_vat: resolvedVatMode === "inclusive",
      cost_price: resolvedUnitCost ?? undefined,
      category: service.category ?? undefined,
      service_type: service.service_type ?? undefined
    }
  };
};

export async function fetchProjectServiceRecords(projectId: string): Promise<ProjectServiceRecord[]> {
  const { data, error } = await supabase
    .from<ProjectServiceJoin>("project_services")
    .select(
      `
        id,
        project_id,
        billing_type,
        quantity,
        unit_cost_override,
        unit_price_override,
        vat_mode_override,
        vat_rate_override,
        services (
          id,
          name,
          extra,
          selling_price,
          price,
          vat_rate,
          price_includes_vat,
          cost_price,
          category,
          service_type
        )
      `
    )
    .eq("project_id", projectId);

  if (error) throw error;

  return (data ?? [])
    .map(mapRecord)
    .filter((record): record is ProjectServiceRecord => Boolean(record));
}
