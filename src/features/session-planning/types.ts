export type SessionPlanningStepId =
  | "lead"
  | "project"
  | "sessionType"
  | "location"
  | "schedule"
  | "notes"
  | "summary";

export interface SessionPlanningLead {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  mode: "existing" | "new";
}

export interface SessionPlanningProject {
  id?: string;
  name?: string;
  description?: string;
  mode: "existing" | "new";
}

export interface SessionPlanningSchedule {
  date?: string;
  time?: string;
  timezone?: string;
}

export interface SessionPlanningNotifications {
  sendSummaryEmail: boolean;
  sendReminder: boolean;
}

export interface SessionPlanningMetaState {
  currentStep: SessionPlanningStepId;
  isDirty: boolean;
  isSavingDraft: boolean;
  lastSavedAt?: string;
  entrySource?: string;
}

export interface SessionPlanningState {
  lead: SessionPlanningLead;
  project: SessionPlanningProject;
  sessionTypeId?: string;
  sessionTypeLabel?: string;
  sessionName?: string;
  location?: string;
  meetingUrl?: string;
  schedule: SessionPlanningSchedule;
  notes?: string;
  notifications: SessionPlanningNotifications;
  meta: SessionPlanningMetaState;
}

export interface SessionPlanningEntryContext {
  leadId?: string;
  leadName?: string;
  projectId?: string;
  projectName?: string;
  defaultDate?: string;
  defaultTime?: string;
  entrySource?: string;
}

export type SessionPlanningAction =
  | { type: "LOAD_ENTRY_CONTEXT"; payload: SessionPlanningEntryContext }
  | { type: "SET_STEP"; payload: SessionPlanningStepId }
  | { type: "UPDATE_LEAD"; payload: SessionPlanningLead }
  | { type: "UPDATE_PROJECT"; payload: SessionPlanningProject }
  | { type: "UPDATE_SESSION_TYPE"; payload: { id?: string; label?: string } }
  | { type: "UPDATE_FIELD"; payload: Partial<Omit<SessionPlanningState, "meta" | "lead" | "project" | "schedule" | "notifications">> }
  | { type: "UPDATE_SCHEDULE"; payload: Partial<SessionPlanningSchedule> }
  | { type: "UPDATE_NOTIFICATIONS"; payload: Partial<SessionPlanningNotifications> }
  | { type: "MARK_DIRTY"; payload: boolean }
  | { type: "MARK_SAVING"; payload: boolean }
  | { type: "MARK_SAVED"; payload?: string }
  | { type: "RESET"; payload?: SessionPlanningEntryContext }
  | { type: "APPLY_STATE"; payload: SessionPlanningState };

export interface SessionPlanningDraft {
  state: SessionPlanningState;
  updatedAt: string;
  version: number;
}
