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
  },
  services: {
    packageId: undefined,
    packageLabel: undefined,
    selectedServiceIds: [],
    selectedServices: [],
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
    case "UPDATE_LEAD":
      return {
        ...state,
        lead: {
          ...state.lead,
          ...action.payload,
        },
        meta: {
          ...state.meta,
          isDirty: true,
        },
      };
    case "UPDATE_DETAILS":
      return {
        ...state,
        details: {
          ...state.details,
          ...action.payload,
        },
        meta: {
          ...state.meta,
          isDirty: true,
        },
      };
    case "UPDATE_SERVICES": {
      const nextServices = {
        ...state.services,
        ...action.payload,
      };
      // Ensure we don't accidentally lose the service selections array
      if (!nextServices.selectedServiceIds) {
        nextServices.selectedServiceIds = state.services.selectedServiceIds;
      }
      if (!nextServices.selectedServices) {
        nextServices.selectedServices = state.services.selectedServices;
      }
      return {
        ...state,
        services: nextServices,
        meta: {
          ...state.meta,
          isDirty: true,
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
