import {
  ProjectCreationAction,
  ProjectCreationEntryContext,
  ProjectCreationMetaState,
  ProjectCreationState,
  ProjectCreationStepId,
} from "../types";

const DEFAULT_STEP: ProjectCreationStepId = "lead";

export interface ProjectCreationStepConfig {
  id: ProjectCreationStepId;
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

export const PROJECT_CREATION_STEPS: ProjectCreationStepConfig[] = [
  { id: "lead", labelKey: "steps.lead.navigationLabel" },
  { id: "details", labelKey: "steps.details.navigationLabel" },
  { id: "packages", labelKey: "steps.packages.navigationLabel" },
  { id: "summary", labelKey: "steps.summary.navigationLabel" },
];

const deriveInitialMeta = (entryContext: ProjectCreationEntryContext = {}): ProjectCreationMetaState => ({
  currentStep: computeInitialStep(entryContext),
  isDirty: false,
  entrySource: entryContext.entrySource,
  defaultStatusId: entryContext.defaultStatusId,
  initialEntryContext: Object.keys(entryContext).length ? { ...entryContext } : undefined,
});

export const createInitialProjectCreationState = (
  entryContext: ProjectCreationEntryContext = {}
): ProjectCreationState => ({
  lead: {
    id: entryContext.leadId,
    name: entryContext.leadName,
    mode: entryContext.leadId ? "existing" : "existing",
  },
  details: {
    statusId: entryContext.defaultStatusId ?? undefined,
    statusLabel: undefined,
    projectTypeId: undefined,
    projectTypeLabel: undefined,
    name: undefined,
    description: undefined,
    basePrice: undefined,
    depositAmount: undefined,
  },
  services: {
    packageId: undefined,
    packageLabel: undefined,
    includedItems: [],
    extraItems: [],
    showCustomSetup: false,
  },
  meta: deriveInitialMeta(entryContext),
});

const computeInitialStep = (entryContext: ProjectCreationEntryContext): ProjectCreationStepId => {
  if (entryContext.startStepOverride) {
    return entryContext.startStepOverride;
  }
  if (entryContext.leadId) {
    return "details";
  }
  return DEFAULT_STEP;
};

export const projectCreationReducer = (
  state: ProjectCreationState,
  action: ProjectCreationAction
): ProjectCreationState => {
  switch (action.type) {
    case "LOAD_ENTRY_CONTEXT":
      return createInitialProjectCreationState(action.payload);
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
    case "UPDATE_LEAD": {
      const nextLead = {
        ...state.lead,
        ...action.payload,
      };
      if (shallowEqual(state.lead, nextLead)) {
        return state;
      }
      const shouldMarkDirty = action.markDirty ?? true;
      return {
        ...state,
        lead: nextLead,
        meta: {
          ...state.meta,
          isDirty: shouldMarkDirty ? true : state.meta.isDirty,
        },
      };
    }
    case "UPDATE_DETAILS": {
      const nextDetails = {
        ...state.details,
        ...action.payload,
      };
      if (shallowEqual(state.details, nextDetails)) {
        return state;
      }
      const shouldMarkDirty = action.markDirty ?? true;
      return {
        ...state,
        details: nextDetails,
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
      if (!("includedItems" in action.payload)) {
        nextServices.includedItems = state.services.includedItems;
      }
      if (!("extraItems" in action.payload)) {
        nextServices.extraItems = state.services.extraItems;
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
    case "RESET":
      return createInitialProjectCreationState(action.payload);
    default:
      return state;
  }
};
