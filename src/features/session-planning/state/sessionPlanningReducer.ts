import { SessionPlanningAction, SessionPlanningEntryContext, SessionPlanningState, SessionPlanningStepId } from "../types";

const DEFAULT_NOTIFICATIONS = {
  sendSummaryEmail: true,
  sendReminder: true
} as const;

const DEFAULT_STEP: SessionPlanningStepId = "lead";

export const createInitialSessionPlanningState = (
  entryContext: SessionPlanningEntryContext = {}
): SessionPlanningState => ({
  lead: {
    id: entryContext.leadId,
    name: entryContext.leadName,
    mode: entryContext.leadId ? "existing" : "existing"
  },
  project: {
    id: entryContext.projectId,
    name: entryContext.projectName,
    mode: entryContext.projectId ? "existing" : "existing"
  },
  sessionTypeId: undefined,
  sessionTypeLabel: undefined,
  sessionName: entryContext.projectName
    ? `${entryContext.projectName} Session`
    : entryContext.leadName
      ? `${entryContext.leadName} Session`
      : "",
  locationId: undefined,
  locationLabel: undefined,
  location: "",
  meetingUrl: "",
  schedule: {
    date: entryContext.defaultDate,
    time: entryContext.defaultTime
  },
  notes: "",
  notifications: {
    ...DEFAULT_NOTIFICATIONS
  },
  meta: {
    currentStep: computeInitialStep(entryContext),
    isDirty: false,
    isSavingDraft: false,
    lastSavedAt: undefined,
    entrySource: entryContext.entrySource
  }
});

const computeInitialStep = (entryContext: SessionPlanningEntryContext): SessionPlanningStepId => {
  if (entryContext.leadId) {
    if (entryContext.projectId) {
      return "sessionType";
    }
    return "project";
  }
  return DEFAULT_STEP;
};

export const sessionPlanningReducer = (
  state: SessionPlanningState,
  action: SessionPlanningAction
): SessionPlanningState => {
  switch (action.type) {
    case "LOAD_ENTRY_CONTEXT": {
      return createInitialSessionPlanningState(action.payload);
    }
    case "SET_STEP": {
      if (state.meta.currentStep === action.payload) {
        return state;
      }
      return {
        ...state,
        meta: {
          ...state.meta,
          currentStep: action.payload
        }
      };
    }
    case "UPDATE_LEAD": {
      return {
        ...state,
        lead: {
          ...state.lead,
          ...action.payload
        },
        meta: {
          ...state.meta,
          isDirty: true
        }
      };
    }
    case "UPDATE_PROJECT": {
      return {
        ...state,
        project: {
          ...state.project,
          ...action.payload
        },
        meta: {
          ...state.meta,
          isDirty: true
        }
      };
    }
    case "UPDATE_SESSION_TYPE": {
      const sessionName = action.payload.label
        ? `${action.payload.label}`
        : state.sessionName;

      return {
        ...state,
        sessionTypeId: action.payload.id,
        sessionTypeLabel: action.payload.label,
        sessionName,
        meta: {
          ...state.meta,
          isDirty: true
        }
      };
    }
    case "SET_DEFAULT_SESSION_TYPE": {
      if (state.sessionTypeId) {
        return state;
      }

      const nextLabel = action.payload.label;
      const shouldUpdateName =
        !state.sessionName ||
        !state.sessionName.trim() ||
        state.sessionName === state.sessionTypeLabel;

      return {
        ...state,
        sessionTypeId: action.payload.id,
        sessionTypeLabel: nextLabel,
        sessionName:
          shouldUpdateName && nextLabel
            ? `${nextLabel}`
            : state.sessionName,
        meta: {
          ...state.meta
        }
      };
    }
    case "UPDATE_FIELD": {
      return {
        ...state,
        ...action.payload,
        meta: {
          ...state.meta,
          isDirty: true
        }
      };
    }
    case "UPDATE_SCHEDULE": {
      return {
        ...state,
        schedule: {
          ...state.schedule,
          ...action.payload
        },
        meta: {
          ...state.meta,
          isDirty: true
        }
      };
    }
    case "UPDATE_NOTIFICATIONS": {
      return {
        ...state,
        notifications: {
          ...state.notifications,
          ...action.payload
        },
        meta: {
          ...state.meta,
          isDirty: true
        }
      };
    }
    case "MARK_DIRTY": {
      if (state.meta.isDirty === action.payload) {
        return state;
      }
      return {
        ...state,
        meta: {
          ...state.meta,
          isDirty: action.payload
        }
      };
    }
    case "MARK_SAVING": {
      return {
        ...state,
        meta: {
          ...state.meta,
          isSavingDraft: action.payload
        }
      };
    }
    case "MARK_SAVED": {
      return {
        ...state,
        meta: {
          ...state.meta,
          isDirty: false,
          isSavingDraft: false,
          lastSavedAt: action.payload
        }
      };
    }
    case "RESET": {
      return createInitialSessionPlanningState(action.payload);
    }
    case "APPLY_STATE": {
      return {
        ...action.payload,
        meta: {
          ...action.payload.meta,
          isDirty: false,
          isSavingDraft: false
        }
      };
    }
    default:
      return state;
  }
};

export interface SessionPlanningStepConfig {
  id: SessionPlanningStepId;
  labelKey: string;
}

export const SESSION_PLANNING_STEPS: SessionPlanningStepConfig[] = [
  { id: "lead", labelKey: "steps.lead.navigationLabel" },
  { id: "project", labelKey: "steps.project.navigationLabel" },
  { id: "sessionType", labelKey: "steps.sessionType.navigationLabel" },
  { id: "location", labelKey: "steps.location.navigationLabel" },
  { id: "schedule", labelKey: "steps.schedule.navigationLabel" },
  { id: "notes", labelKey: "steps.notes.navigationLabel" },
  { id: "summary", labelKey: "steps.summary.navigationLabel" }
];
