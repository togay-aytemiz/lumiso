export type PackageCreationStepId =
  | "basics"
  | "services"
  | "delivery"
  | "pricing"
  | "summary";

export interface PackageCreationBasics {
  name: string;
  description: string;
  applicableTypeIds: string[];
  isActive: boolean;
}

export type PackageLineItemType = "existing" | "custom";
export type PackageVatMode = "inclusive" | "exclusive";

export interface PackageCreationLineItem {
  id: string;
  type: PackageLineItemType;
  serviceId?: string;
  name: string;
  quantity: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  vendorName?: string | null;
  source?: "catalog" | "adhoc";
  vatRate?: number | null;
  vatMode?: PackageVatMode;
  unit?: string | null;
}

export interface PackageCreationServicesState {
  items: PackageCreationLineItem[];
  showQuickAdd: boolean;
}

export interface PackageCreationDeliveryState {
  enablePhotoEstimate: boolean;
  enableLeadTime: boolean;
  enableMethods: boolean;
  estimateType: "single" | "range";
  countMin?: number | null;
  countMax?: number | null;
  leadTimeValue?: number | null;
  leadTimeUnit: "days" | "weeks";
  methods: string[];
  customMethodDraft: string;
}

export interface PackageCreationPricingState {
  basePrice: string;
  packageVatRate: number | null;
  packageVatMode: PackageVatMode;
  packageVatOverrideEnabled: boolean;
  packageVatInitialized: boolean;
  depositMode: "percent_subtotal" | "percent_base" | "fixed";
  depositValue: string;
  enableDeposit: boolean;
  includeAddOnsInPrice: boolean;
}

export interface PackageCreationMetaState {
  currentStep: PackageCreationStepId;
  isDirty: boolean;
  entrySource?: string;
  startStepOverride?: PackageCreationStepId;
  initialEntryContext?: PackageCreationEntryContext;
  mode: "create" | "edit";
}

export interface PackageCreationState {
  basics: PackageCreationBasics;
  services: PackageCreationServicesState;
  delivery: PackageCreationDeliveryState;
  pricing: PackageCreationPricingState;
  meta: PackageCreationMetaState;
}

export interface PackageCreationEntryContext {
  entrySource?: string;
  startStepOverride?: PackageCreationStepId;
  mode?: "create" | "edit";
}

export interface PackageCreationHydrationPayload {
  basics: PackageCreationBasics;
  services: PackageCreationServicesState;
  delivery: PackageCreationDeliveryState;
  pricing: PackageCreationPricingState;
  meta?: Partial<PackageCreationMetaState>;
}

export type PackageCreationAction =
  | { type: "LOAD_ENTRY_CONTEXT"; payload: PackageCreationEntryContext }
  | { type: "SET_STEP"; payload: PackageCreationStepId }
  | {
      type: "UPDATE_BASICS";
      payload: Partial<PackageCreationBasics>;
      markDirty?: boolean;
    }
  | {
      type: "UPDATE_SERVICES";
      payload: Partial<PackageCreationServicesState>;
      markDirty?: boolean;
    }
  | {
      type: "UPDATE_DELIVERY";
      payload: Partial<PackageCreationDeliveryState>;
      markDirty?: boolean;
    }
  | {
      type: "UPDATE_PRICING";
      payload: Partial<PackageCreationPricingState>;
      markDirty?: boolean;
    }
  | { type: "MARK_DIRTY"; payload: boolean }
  | { type: "RESET"; payload?: PackageCreationEntryContext }
  | { type: "HYDRATE_STATE"; payload: PackageCreationHydrationPayload };
