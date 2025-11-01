import {
  PackageCreationAction,
  PackageCreationBasics,
  PackageCreationDeliveryState,
  PackageCreationEntryContext,
  PackageCreationMetaState,
  PackageCreationPricingState,
  PackageCreationServicesState,
  PackageCreationState,
  PackageCreationStepId,
} from "../types";

const DEFAULT_STEP: PackageCreationStepId = "basics";

export interface PackageCreationStepConfig {
  id: PackageCreationStepId;
  labelKey: string;
}

const shallowEqual = <T extends Record<string, unknown>>(a: T, b: T) => {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    if (!Object.is(a[key as keyof T], b[key as keyof T])) {
      return false;
    }
  }
  return true;
};

export const PACKAGE_CREATION_STEPS: PackageCreationStepConfig[] = [
  { id: "basics", labelKey: "steps.basics.navigationLabel" },
  { id: "services", labelKey: "steps.services.navigationLabel" },
  { id: "delivery", labelKey: "steps.delivery.navigationLabel" },
  { id: "pricing", labelKey: "steps.pricing.navigationLabel" },
  { id: "summary", labelKey: "steps.summary.navigationLabel" },
];

const createInitialBasics = (): PackageCreationBasics => ({
  name: "",
  description: "",
  applicableTypeIds: [],
  isActive: true,
});

const createInitialServicesState = (): PackageCreationServicesState => ({
  items: [],
  showQuickAdd: false,
});

const createInitialDeliveryState = (): PackageCreationDeliveryState => ({
  enablePhotoEstimate: false,
  enableLeadTime: false,
  enableMethods: false,
  estimateType: "single",
  countMin: null,
  countMax: null,
  leadTimeValue: null,
  leadTimeUnit: "days",
  methods: [],
  customMethodDraft: "",
});

const createInitialPricingState = (): PackageCreationPricingState => ({
  basePrice: "",
  depositMode: "percent_subtotal",
  depositValue: "",
  enableDeposit: false,
  includeAddOnsInPrice: true,
});

const deriveInitialMeta = (
  entryContext: PackageCreationEntryContext = {}
): PackageCreationMetaState => ({
  currentStep: computeInitialStep(entryContext),
  isDirty: false,
  entrySource: entryContext.entrySource,
  startStepOverride: entryContext.startStepOverride,
  initialEntryContext: Object.keys(entryContext).length ? { ...entryContext } : undefined,
  mode: entryContext.mode ?? "create",
});

export const createInitialPackageCreationState = (
  entryContext: PackageCreationEntryContext = {}
): PackageCreationState => ({
  basics: createInitialBasics(),
  services: createInitialServicesState(),
  delivery: createInitialDeliveryState(),
  pricing: createInitialPricingState(),
  meta: deriveInitialMeta(entryContext),
});

const computeInitialStep = (entryContext: PackageCreationEntryContext): PackageCreationStepId => {
  if (entryContext.startStepOverride) {
    return entryContext.startStepOverride;
  }
  return DEFAULT_STEP;
};

export const packageCreationReducer = (
  state: PackageCreationState,
  action: PackageCreationAction
): PackageCreationState => {
  switch (action.type) {
    case "LOAD_ENTRY_CONTEXT":
      return createInitialPackageCreationState(action.payload);
    case "SET_STEP":
      if (state.meta.currentStep === action.payload) {
        return state;
      }
      return {
        ...state,
        meta: {
          ...state.meta,
          currentStep: action.payload,
        },
      };
    case "UPDATE_BASICS": {
      const nextBasics = { ...state.basics, ...action.payload };
      if (shallowEqual(state.basics, nextBasics)) {
        return state;
      }
      const shouldMarkDirty = action.markDirty ?? true;
      return {
        ...state,
        basics: nextBasics,
        meta: {
          ...state.meta,
          isDirty: shouldMarkDirty ? true : state.meta.isDirty,
        },
      };
    }
    case "UPDATE_SERVICES": {
      const nextServices = {
        ...state.services,
        ...action.payload,
      };
      if (!nextServices.items) {
        nextServices.items = state.services.items;
      }
      if (shallowEqual(state.services, nextServices)) {
        return state;
      }
      const shouldMarkDirty = action.markDirty ?? true;
      return {
        ...state,
        services: nextServices,
        meta: {
          ...state.meta,
          isDirty: shouldMarkDirty ? true : state.meta.isDirty,
        },
      };
    }
    case "UPDATE_DELIVERY": {
      const nextDelivery = {
        ...state.delivery,
        ...action.payload,
      };
      if (shallowEqual(state.delivery, nextDelivery)) {
        return state;
      }
      const shouldMarkDirty = action.markDirty ?? true;
      return {
        ...state,
        delivery: nextDelivery,
        meta: {
          ...state.meta,
          isDirty: shouldMarkDirty ? true : state.meta.isDirty,
        },
      };
    }
    case "UPDATE_PRICING": {
      const nextPricing = {
        ...state.pricing,
        ...action.payload,
      };
      if (shallowEqual(state.pricing, nextPricing)) {
        return state;
      }
      const shouldMarkDirty = action.markDirty ?? true;
      return {
        ...state,
        pricing: nextPricing,
        meta: {
          ...state.meta,
          isDirty: shouldMarkDirty ? true : state.meta.isDirty,
        },
      };
    }
    case "MARK_DIRTY":
      if (state.meta.isDirty === action.payload) {
        return state;
      }
      return {
        ...state,
        meta: {
          ...state.meta,
          isDirty: action.payload,
        },
      };
    case "HYDRATE_STATE": {
      const nextMeta: PackageCreationMetaState = {
        ...state.meta,
        isDirty: false,
      };
      const meta = action.payload.meta;
      if (meta) {
        if (meta.currentStep) {
          nextMeta.currentStep = meta.currentStep;
        }
        if (meta.entrySource !== undefined) {
          nextMeta.entrySource = meta.entrySource;
        }
        if (meta.startStepOverride !== undefined) {
          nextMeta.startStepOverride = meta.startStepOverride;
        }
        if (meta.initialEntryContext !== undefined) {
          nextMeta.initialEntryContext = meta.initialEntryContext;
        }
      }

      return {
        basics: action.payload.basics,
        services: action.payload.services,
        delivery: action.payload.delivery,
        pricing: action.payload.pricing,
        meta: nextMeta,
      };
    }
    case "RESET":
      return createInitialPackageCreationState(action.payload);
    default:
      return state;
  }
};
