import type { Database } from "@/integrations/supabase/types";

type PackageRow = Database["public"]["Tables"]["packages"]["Row"];

export type ProjectPackageEstimateType = "single" | "range";

export interface ProjectPackageDeliveryMethodSnapshot {
  methodId: string;
  name: string;
}

export interface ProjectPackageLineItemSnapshot {
  id: string;
  type: "existing" | "custom";
  serviceId?: string;
  name: string;
  quantity: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  vendorName?: string | null;
  source?: "catalog" | "adhoc";
  vatRate?: number | null;
  vatMode?: "inclusive" | "exclusive";
  unit?: string | null;
}

export interface ProjectPackageDeliverySnapshot {
  estimateType: ProjectPackageEstimateType;
  photoCountMin?: number | null;
  photoCountMax?: number | null;
  leadTimeValue?: number | null;
  leadTimeUnit?: "days" | "weeks" | null;
  methods: ProjectPackageDeliveryMethodSnapshot[];
  photosEnabled?: boolean;
  leadTimeEnabled?: boolean;
  methodsEnabled?: boolean;
}

export interface ProjectPackageSnapshot {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  clientTotal?: number | null;
  includeAddOnsInPrice?: boolean | null;
  delivery?: ProjectPackageDeliverySnapshot;
  lineItems: ProjectPackageLineItemSnapshot[];
}

const isLineItem = (value: unknown): value is ProjectPackageLineItemSnapshot => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.type === "string" &&
    typeof item.name === "string" &&
    typeof item.quantity !== "undefined"
  );
};

const parseLineItems = (value: unknown): ProjectPackageLineItemSnapshot[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isLineItem).map((item) => {
    const snapshot = item as ProjectPackageLineItemSnapshot;
    return {
      id: snapshot.id,
      type: snapshot.type,
      serviceId: snapshot.serviceId,
      name: snapshot.name,
      quantity: snapshot.quantity,
      unitCost: snapshot.unitCost ?? null,
      unitPrice: snapshot.unitPrice ?? null,
      vendorName: snapshot.vendorName ?? null,
      source: snapshot.source,
      vatRate: snapshot.vatRate ?? null,
      vatMode: snapshot.vatMode,
      unit: snapshot.unit ?? null
    };
  });
};

const parseDeliveryMethods = (value: unknown): ProjectPackageDeliveryMethodSnapshot[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (method): method is { methodId: string; name?: string | null } =>
        !!method && typeof method === "object" && typeof (method as { methodId?: unknown }).methodId === "string"
    )
    .map((method) => {
      const { methodId, name } = method as { methodId: string; name?: string | null };
      return {
        methodId,
        name: name ?? methodId
      };
    });
};

export const buildProjectPackageSnapshot = (record: PackageRow): ProjectPackageSnapshot => {
  const estimateType: ProjectPackageEstimateType =
    record.delivery_estimate_type === "range" ? "range" : "single";
  const parsedMethods = parseDeliveryMethods(record.delivery_methods);
  const photosEnabled =
    record.delivery_photo_count_min !== null || record.delivery_photo_count_max !== null;
  const leadTimeEnabled =
    record.delivery_lead_time_value !== null && record.delivery_lead_time_value !== undefined;
  const methodsEnabled = parsedMethods.length > 0;

  return {
    id: record.id,
    name: record.name,
    description: record.description ?? null,
    price: record.price ?? null,
    clientTotal: record.client_total ?? null,
    includeAddOnsInPrice: record.include_addons_in_price ?? null,
    delivery: {
      estimateType,
      photoCountMin: photosEnabled ? record.delivery_photo_count_min ?? null : null,
      photoCountMax:
        photosEnabled && estimateType === "range" ? record.delivery_photo_count_max ?? null : null,
      leadTimeValue: leadTimeEnabled ? record.delivery_lead_time_value ?? null : null,
      leadTimeUnit:
        leadTimeEnabled && record.delivery_lead_time_unit === "weeks" ? "weeks" : leadTimeEnabled ? "days" : null,
      methods: methodsEnabled ? parsedMethods : [],
      photosEnabled,
      leadTimeEnabled,
      methodsEnabled,
    },
    lineItems: parseLineItems(record.line_items)
  };
};

export const parseProjectPackageSnapshot = (
  snapshot: unknown
): ProjectPackageSnapshot | null => {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  const value = snapshot as Record<string, unknown>;
  if (typeof value.id !== "string" || typeof value.name !== "string") {
    return null;
  }
  const deliveryValue = value.delivery ?? null;
  const delivery: ProjectPackageDeliverySnapshot | undefined =
    deliveryValue && typeof deliveryValue === "object"
      ? {
          estimateType:
            (deliveryValue as Record<string, unknown>).estimateType === "range" ? "range" : "single",
          photoCountMin: (deliveryValue as Record<string, unknown>).photoCountMin as number | null | undefined,
          photoCountMax: (deliveryValue as Record<string, unknown>).photoCountMax as number | null | undefined,
          leadTimeValue: (deliveryValue as Record<string, unknown>).leadTimeValue as number | null | undefined,
          leadTimeUnit: (deliveryValue as Record<string, unknown>).leadTimeUnit as
            | "days"
            | "weeks"
            | null
            | undefined,
          methods: parseDeliveryMethods(
            (deliveryValue as Record<string, unknown>).methods ?? []
          ),
          photosEnabled: (deliveryValue as Record<string, unknown>).photosEnabled as boolean | undefined,
          leadTimeEnabled: (deliveryValue as Record<string, unknown>).leadTimeEnabled as boolean | undefined,
          methodsEnabled: (deliveryValue as Record<string, unknown>).methodsEnabled as boolean | undefined,
        }
      : undefined;

  return {
    id: value.id,
    name: value.name,
    description: (value.description as string | null | undefined) ?? null,
    price: (value.price as number | null | undefined) ?? null,
    clientTotal: (value.clientTotal as number | null | undefined) ?? null,
    includeAddOnsInPrice:
      (value.includeAddOnsInPrice as boolean | null | undefined) ?? null,
    delivery,
    lineItems: parseLineItems(value.lineItems)
  };
};
