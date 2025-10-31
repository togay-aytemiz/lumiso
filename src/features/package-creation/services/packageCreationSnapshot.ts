import type { Database, Json } from "@/integrations/supabase/types";
import type {
  PackageCreationBasics,
  PackageCreationDeliveryState,
  PackageCreationLineItem,
  PackageCreationPricingState,
  PackageCreationServicesState,
  PackageCreationState,
  PackageLineItemType,
} from "../types";

type PackageInsert = Database["public"]["Tables"]["packages"]["Insert"];
type PackageRow = Database["public"]["Tables"]["packages"]["Row"];
type PackageUpdate = Database["public"]["Tables"]["packages"]["Update"];

export interface PackageLineItemPayload {
  id: string;
  type: PackageLineItemType;
  role: "addon";
  serviceId: string | null;
  name: string;
  quantity: number;
  unitCost: number | null;
  unitPrice: number | null;
  vendorName: string | null;
  source?: "catalog" | "adhoc";
}

export interface PackageDeliveryMethodPayload {
  methodId: string;
  name: string | null;
}

export interface PackagePricingDetailsPayload {
  basePrice: number;
  servicesCostTotal: number;
  servicesPriceTotal: number;
  servicesMargin: number;
  subtotal: number;
  clientTotal: number;
  includeAddOnsInPrice: boolean;
  depositMode: PackageCreationState["pricing"]["depositMode"];
  depositValue: number;
  depositTarget?: "subtotal" | "base";
  depositAmount: number;
  enableDeposit: boolean;
}

export interface PackageServicesSnapshot {
  items: PackageLineItemPayload[];
  totals: {
    cost: number;
    price: number;
  };
  defaultAddOnIds: string[];
  itemCount: number;
  totalQuantity: number;
}

export interface PackageDeliverySnapshot {
  photosEnabled: boolean;
  leadTimeEnabled: boolean;
  methodsEnabled: boolean;
  estimateType: PackageCreationState["delivery"]["estimateType"];
  photoCountMin: number | null;
  photoCountMax: number | null;
  leadTimeValue: number | null;
  leadTimeUnit: PackageCreationState["delivery"]["leadTimeUnit"] | null;
  methods: PackageDeliveryMethodPayload[];
}

export interface PackageBasicsSnapshot {
  name: string;
  description: string | null;
  applicableTypeIds: string[];
  isActive: boolean;
}

export interface PackageSnapshot {
  basics: PackageBasicsSnapshot;
  services: PackageServicesSnapshot;
  delivery: PackageDeliverySnapshot;
  pricing: PackagePricingDetailsPayload;
  meta: {
    selectedServiceCount: number;
    totalSelectedQuantity: number;
  };
}

export interface DeliveryMethodCatalogEntry {
  id: string;
  name: string | null;
}

export interface CreatePackageSnapshotOptions {
  deliveryMethodsCatalog?: DeliveryMethodCatalogEntry[];
}

export interface PackagePersistenceContext {
  userId: string;
  organizationId: string;
}

export interface PackagePersistencePayload {
  snapshot: PackageSnapshot;
  insert: PackageInsert;
}

export interface PackageHydrationSlices {
  basics: PackageCreationBasics;
  services: PackageCreationServicesState;
  delivery: PackageCreationDeliveryState;
  pricing: PackageCreationPricingState;
}

export const createPackageSnapshot = (
  state: PackageCreationState,
  options: CreatePackageSnapshotOptions = {}
): PackageSnapshot => {
  const basics = buildBasicsSnapshot(state);
  const services = buildServicesSnapshot(state.services.items);
  const delivery = buildDeliverySnapshot(state, options.deliveryMethodsCatalog ?? []);
  const pricing = buildPricingSnapshot(state, services.totals);

  return {
    basics,
    services,
    delivery,
    pricing,
    meta: {
      selectedServiceCount: services.itemCount,
      totalSelectedQuantity: services.totalQuantity,
    },
  };
};

export const buildPackageInsertPayload = (
  snapshot: PackageSnapshot,
  context: PackagePersistenceContext
): PackageInsert => {
  const lineItemsJson = snapshot.services.items as unknown as Json;
  const deliveryMethodsJson = snapshot.delivery.methodsEnabled
    ? (snapshot.delivery.methods as unknown as Json)
    : ([] as unknown as Json);

  const hasLeadTimeValue = snapshot.delivery.leadTimeEnabled && snapshot.delivery.leadTimeValue !== null && snapshot.delivery.leadTimeValue !== undefined;
  const applicableTypes = snapshot.basics.applicableTypeIds.filter(Boolean);
  const defaultAddOns = snapshot.services.defaultAddOnIds;
  const pricingMetadata = buildPricingMetadata(snapshot.pricing);

  const insertPayload: PackageInsert = {
    user_id: context.userId,
    organization_id: context.organizationId,
    name: snapshot.basics.name,
    description: snapshot.basics.description,
    price: snapshot.pricing.basePrice,
    client_total: snapshot.pricing.clientTotal,
    applicable_types: applicableTypes.length ? applicableTypes : [],
    default_add_ons: defaultAddOns.length ? defaultAddOns : [],
    is_active: snapshot.basics.isActive,
    line_items: lineItemsJson,
    delivery_estimate_type: snapshot.delivery.estimateType,
    delivery_photo_count_min: snapshot.delivery.photoCountMin,
    delivery_photo_count_max: snapshot.delivery.photoCountMax,
    delivery_lead_time_value: hasLeadTimeValue ? snapshot.delivery.leadTimeValue : null,
    delivery_lead_time_unit: hasLeadTimeValue ? snapshot.delivery.leadTimeUnit ?? null : null,
    delivery_methods: deliveryMethodsJson,
    include_addons_in_price: snapshot.pricing.includeAddOnsInPrice,
    pricing_metadata: pricingMetadata,
  };

  return insertPayload;
};

export const buildPackageUpdatePayload = (
  snapshot: PackageSnapshot,
  packageId: string
): PackageUpdate => {
  const lineItemsJson = snapshot.services.items as unknown as Json;
  const deliveryMethodsJson = snapshot.delivery.methodsEnabled
    ? (snapshot.delivery.methods as unknown as Json)
    : ([] as unknown as Json);
  const hasLeadTimeValue =
    snapshot.delivery.leadTimeEnabled &&
    snapshot.delivery.leadTimeValue !== null &&
    snapshot.delivery.leadTimeValue !== undefined;
  const applicableTypes = snapshot.basics.applicableTypeIds.filter(Boolean);
  const defaultAddOns = snapshot.services.defaultAddOnIds;
  const pricingMetadata = buildPricingMetadata(snapshot.pricing);

  const updatePayload: PackageUpdate = {
    id: packageId,
    name: snapshot.basics.name,
    description: snapshot.basics.description ?? null,
    price: snapshot.pricing.basePrice,
    client_total: snapshot.pricing.clientTotal,
    applicable_types: applicableTypes.length ? applicableTypes : [],
    default_add_ons: defaultAddOns.length ? defaultAddOns : [],
    is_active: snapshot.basics.isActive,
    line_items: lineItemsJson,
    delivery_estimate_type: snapshot.delivery.estimateType,
    delivery_photo_count_min: snapshot.delivery.photoCountMin,
    delivery_photo_count_max: snapshot.delivery.photoCountMax,
    delivery_lead_time_value: hasLeadTimeValue ? snapshot.delivery.leadTimeValue : null,
    delivery_lead_time_unit: hasLeadTimeValue ? snapshot.delivery.leadTimeUnit ?? null : null,
    delivery_methods: deliveryMethodsJson,
    include_addons_in_price: snapshot.pricing.includeAddOnsInPrice,
    pricing_metadata: pricingMetadata,
  };

  return updatePayload;
};

export const preparePackagePersistence = (
  state: PackageCreationState,
  context: PackagePersistenceContext,
  options: CreatePackageSnapshotOptions = {}
): PackagePersistencePayload => {
  const snapshot = createPackageSnapshot(state, options);
  const insert = buildPackageInsertPayload(snapshot, context);

  return { snapshot, insert };
};

export const buildPackageHydrationFromRecord = (
  record: PackageRow
): PackageHydrationSlices => {
  const basics: PackageCreationBasics = {
    name: record.name ?? "",
    description: record.description ?? "",
    applicableTypeIds: Array.isArray(record.applicable_types)
      ? (record.applicable_types.filter(Boolean) as string[])
      : [],
    isActive: record.is_active ?? true,
  };

  const services: PackageCreationServicesState = {
    items: parseServiceLineItems(record.line_items),
    showQuickAdd: false,
  };

  const methodIds = parseDeliveryMethodIds(record.delivery_methods);
  const enablePhotoEstimate =
    record.delivery_photo_count_min !== null || record.delivery_photo_count_max !== null;
  const enableLeadTime =
    record.delivery_lead_time_value !== null &&
    record.delivery_lead_time_value !== undefined;
  const enableMethods = methodIds.length > 0;
  const estimateType =
    record.delivery_estimate_type === "range" ? "range" : "single";

  const delivery: PackageCreationDeliveryState = {
    enablePhotoEstimate,
    enableLeadTime,
    enableMethods,
    estimateType,
    countMin: enablePhotoEstimate ? record.delivery_photo_count_min ?? null : null,
    countMax:
      enablePhotoEstimate && estimateType === "range"
        ? record.delivery_photo_count_max ?? null
        : null,
    leadTimeValue: enableLeadTime ? record.delivery_lead_time_value ?? null : null,
    leadTimeUnit:
      enableLeadTime && record.delivery_lead_time_unit === "weeks" ? "weeks" : "days",
    methods: enableMethods ? methodIds : [],
    customMethodDraft: "",
  };

  const pricingMeta = parsePricingMetadata(record.pricing_metadata);
  const includeAddOnsInPrice =
    record.include_addons_in_price === undefined || record.include_addons_in_price === null
      ? true
      : record.include_addons_in_price;

  const pricing: PackageCreationPricingState = {
    basePrice: record.price != null ? String(record.price) : "",
    depositMode: pricingMeta.depositMode,
    depositValue: pricingMeta.depositValue != null ? String(pricingMeta.depositValue) : "",
    enableDeposit: pricingMeta.enableDeposit,
    includeAddOnsInPrice,
  };

  return {
    basics,
    services,
    delivery,
    pricing,
  };
};

const buildBasicsSnapshot = (state: PackageCreationState): PackageBasicsSnapshot => {
  const name = state.basics.name.trim();
  const description = state.basics.description?.trim() || null;

  return {
    name,
    description,
    applicableTypeIds: state.basics.applicableTypeIds.filter(Boolean),
    isActive: state.basics.isActive,
  };
};

const buildServicesSnapshot = (items: PackageCreationLineItem[]): PackageServicesSnapshot => {
  const payloadItems = items.map(toLineItemPayload);
  const totals = payloadItems.reduce(
    (accum, item) => {
      const quantity = item.quantity;
      const unitCost = item.unitCost ?? 0;
      const unitPrice = item.unitPrice ?? 0;

      accum.cost += unitCost * quantity;
      accum.price += unitPrice * quantity;

      return accum;
    },
    { cost: 0, price: 0 }
  );

  const defaultAddOnIds = Array.from(
    new Set(
      payloadItems
        .filter((item) => item.type === "existing" && Boolean(item.serviceId))
        .map((item) => item.serviceId as string)
    )
  );

  const totalQuantity = payloadItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: payloadItems,
    totals: {
      cost: roundCurrency(totals.cost),
      price: roundCurrency(totals.price),
    },
    defaultAddOnIds,
    itemCount: payloadItems.length,
    totalQuantity,
  };
};

const buildDeliverySnapshot = (
  state: PackageCreationState,
  catalog: DeliveryMethodCatalogEntry[]
): PackageDeliverySnapshot => {
  const catalogMap = new Map(catalog.map((entry) => [entry.id, entry]));
  const photosEnabled = state.delivery.enablePhotoEstimate !== false;
  const leadTimeEnabled = state.delivery.enableLeadTime !== false;
  const methodsEnabled = state.delivery.enableMethods !== false;

  const enabledMethodIds = methodsEnabled
    ? Array.from(new Set((state.delivery.methods ?? []).filter(Boolean)))
    : [];

  const methods: PackageDeliveryMethodPayload[] = enabledMethodIds.map((methodId) => {
    const entry = catalogMap.get(methodId);
    return {
      methodId,
      name: entry?.name ?? null,
    };
  });

  const estimateType = state.delivery.estimateType;
  const photoCountMin = photosEnabled ? normalizeInteger(state.delivery.countMin) : null;
  const photoCountMax = photosEnabled && estimateType === "range"
    ? normalizeInteger(state.delivery.countMax)
    : null;

  const leadTimeValue = leadTimeEnabled
    ? normalizeInteger(state.delivery.leadTimeValue, { allowZero: true })
    : null;
  const leadTimeUnit = leadTimeValue === null ? null : state.delivery.leadTimeUnit ?? "days";

  return {
    photosEnabled,
    leadTimeEnabled,
    methodsEnabled,
    estimateType,
    photoCountMin,
    photoCountMax,
    leadTimeValue,
    leadTimeUnit,
    methods,
  };
};

const buildPricingSnapshot = (
  state: PackageCreationState,
  totals: { cost: number; price: number }
): PackagePricingDetailsPayload => {
  const basePrice = roundCurrency(parseCurrency(state.pricing.basePrice));
  const servicesCostTotal = roundCurrency(totals.cost);
  const servicesPriceTotal = roundCurrency(totals.price);
  const servicesMargin = roundCurrency(servicesPriceTotal - servicesCostTotal);
  const subtotal = roundCurrency(basePrice + servicesPriceTotal);
  const includeAddOns = state.pricing.includeAddOnsInPrice ?? true;
  const clientTotal = roundCurrency(includeAddOns ? basePrice : subtotal);

  const depositMode = state.pricing.depositMode;
  const enableDeposit = Boolean(state.pricing.enableDeposit);

  if (depositMode === "fixed") {
    const depositRaw = roundCurrency(parseCurrency(state.pricing.depositValue));
    const depositAmount = enableDeposit ? depositRaw : 0;
    return {
      basePrice,
      servicesCostTotal,
      servicesPriceTotal,
      servicesMargin,
      subtotal,
      clientTotal,
      includeAddOnsInPrice: includeAddOns,
      depositMode,
      depositValue: depositRaw,
      depositAmount,
      enableDeposit,
    };
  }

  const depositTarget = depositMode === "percent_base" ? "base" : "subtotal";
  const percentValue = Math.max(0, parsePercent(state.pricing.depositValue));
  const calculationTarget =
    depositTarget === "base"
      ? basePrice
      : includeAddOns
      ? clientTotal
      : subtotal;
  const depositAmount = roundCurrency((calculationTarget * percentValue) / 100);

  return {
    basePrice,
    servicesCostTotal,
    servicesPriceTotal,
    servicesMargin,
    subtotal,
    clientTotal,
    includeAddOnsInPrice: includeAddOns,
    depositMode,
    depositTarget,
    depositValue: percentValue,
    depositAmount: enableDeposit ? depositAmount : 0,
    enableDeposit,
  };
};

const toLineItemPayload = (item: PackageCreationLineItem): PackageLineItemPayload => {
  const quantity = normalizeInteger(item.quantity, { fallback: 1 }) ?? 1;
  const name = item.name?.trim() || "Unnamed service";

  const unitCost = normalizeMoney(item.unitCost);
  const unitPrice = normalizeMoney(item.unitPrice);

  const payload: PackageLineItemPayload = {
    id: item.id,
    type: item.type,
    role: "addon",
    serviceId: item.type === "existing" ? item.serviceId ?? null : null,
    name,
    quantity,
    unitCost,
    unitPrice,
    vendorName: item.vendorName ?? null,
  };

  if (item.source) {
    payload.source = item.source;
  }

  return payload;
};

const buildPricingMetadata = (pricing: PackagePricingDetailsPayload): Json => {
  return {
    enableDeposit: pricing.enableDeposit,
    depositMode: pricing.depositMode,
    depositValue: pricing.depositValue,
    depositTarget: pricing.depositTarget ?? null,
    depositAmount: pricing.depositAmount,
  } as Json;
};

const parseServiceLineItems = (value: Json): PackageCreationLineItem[] => {
  if (!Array.isArray(value)) return [];

  return (value as unknown[]).map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return createFallbackLineItem(index);
    }

    const item = entry as Record<string, unknown>;
    const type: PackageLineItemType =
      item.type === "existing" ? "existing" : "custom";
    const quantity =
      normalizeInteger(
        typeof item.quantity === "number"
          ? item.quantity
          : Number(item.quantity ?? 1),
        { fallback: 1 }
      ) ?? 1;

    const unitCost =
      item.unitCost != null && !Number.isNaN(Number(item.unitCost))
        ? Number(item.unitCost)
        : undefined;
    const unitPrice =
      item.unitPrice != null && !Number.isNaN(Number(item.unitPrice))
        ? Number(item.unitPrice)
        : undefined;
    const source =
      item.source === "catalog" || item.source === "adhoc"
        ? (item.source as "catalog" | "adhoc")
        : undefined;

    return {
      id: typeof item.id === "string" ? item.id : createRandomId(),
      type,
      serviceId:
        type === "existing" && typeof item.serviceId === "string"
          ? item.serviceId
          : undefined,
      name:
        typeof item.name === "string" && item.name.trim().length
          ? item.name
          : `Hizmet ${index + 1}`,
      quantity,
      unitCost,
      unitPrice,
      vendorName:
        typeof item.vendorName === "string" ? item.vendorName : undefined,
      source,
    };
  });
};

const parseDeliveryMethodIds = (value: Json): string[] => {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];

  for (const entry of value as unknown[]) {
    if (typeof entry === "string") {
      ids.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      if (typeof record.methodId === "string") {
        ids.push(record.methodId);
      } else if (typeof record.id === "string") {
        ids.push(record.id);
      }
    }
  }

  return Array.from(new Set(ids));
};

const parsePricingMetadata = (
  value: Json
): {
  enableDeposit: boolean;
  depositMode: PackageCreationState["pricing"]["depositMode"];
  depositValue: number | null;
} => {
  if (!value || typeof value !== "object") {
    return {
      enableDeposit: false,
      depositMode: "percent_subtotal",
      depositValue: null,
    };
  }

  const metadata = value as Record<string, unknown>;
  const enableDeposit = Boolean(metadata.enableDeposit);
  const rawMode = metadata.depositMode;
  const depositMode: PackageCreationState["pricing"]["depositMode"] =
    rawMode === "percent_base" || rawMode === "fixed"
      ? (rawMode as PackageCreationState["pricing"]["depositMode"])
      : "percent_subtotal";

  const depositValue =
    typeof metadata.depositValue === "number"
      ? metadata.depositValue
      : Number.isFinite(Number(metadata.depositValue))
      ? Number(metadata.depositValue)
      : null;

  return {
    enableDeposit,
    depositMode,
    depositValue,
  };
};

const createFallbackLineItem = (seed: number): PackageCreationLineItem => ({
  id: createRandomId(),
  type: "custom",
  name: `Hizmet ${seed + 1}`,
  quantity: 1,
});

const createRandomId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pkg_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeInteger = (
  value: number | null | undefined,
  options: { allowZero?: boolean; fallback?: number } = {}
): number | null => {
  if (value === null || value === undefined) {
    return options.fallback ?? null;
  }

  const parsed = Number.isFinite(value) ? Math.floor(Number(value)) : NaN;
  if (!Number.isFinite(parsed)) {
    return options.fallback ?? null;
  }

  if (!options.allowZero && parsed <= 0) {
    return options.fallback ?? null;
  }

  return parsed;
};

const normalizeMoney = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (Number.isNaN(value)) return null;
  return roundCurrency(Number(value));
};

const parseCurrency = (input: string | number | null | undefined): number => {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : 0;
  }

  if (!input) return 0;

  const numeric = Number.parseFloat(String(input).replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
  return Number.isFinite(numeric) ? numeric : 0;
};

const parsePercent = (input: string | number | null | undefined): number => {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : 0;
  }

  if (!input) return 0;

  const numeric = Number.parseFloat(String(input).replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundCurrency = (value: number): number => {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
};
