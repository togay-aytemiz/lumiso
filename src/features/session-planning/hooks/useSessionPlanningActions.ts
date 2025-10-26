import { useCallback } from "react";
import { useSessionPlanningContext } from "./useSessionPlanningContext";
import {
  SessionPlanningEntryContext,
  SessionPlanningLead,
  SessionPlanningNotifications,
  SessionPlanningProject,
  SessionPlanningSchedule,
  SessionPlanningStepId
} from "../types";

export const useSessionPlanningActions = () => {
  const { dispatch } = useSessionPlanningContext();

  const loadEntryContext = useCallback(
    (context: SessionPlanningEntryContext) => {
      dispatch({ type: "LOAD_ENTRY_CONTEXT", payload: context });
    },
    [dispatch]
  );

  const setCurrentStep = useCallback(
    (step: SessionPlanningStepId) => {
      dispatch({ type: "SET_STEP", payload: step });
    },
    [dispatch]
  );

  const updateLead = useCallback(
    (lead: SessionPlanningLead) => {
      dispatch({ type: "UPDATE_LEAD", payload: lead });
    },
    [dispatch]
  );

  const updateProject = useCallback(
    (project: SessionPlanningProject) => {
      dispatch({ type: "UPDATE_PROJECT", payload: project });
    },
    [dispatch]
  );

  const updateSessionType = useCallback(
    (sessionType: { id?: string; label?: string }) => {
      dispatch({ type: "UPDATE_SESSION_TYPE", payload: sessionType });
    },
    [dispatch]
  );

  const updateSessionFields = useCallback(
    (fields: Record<string, unknown>) => {
      dispatch({ type: "UPDATE_FIELD", payload: fields });
    },
    [dispatch]
  );

  const updateSchedule = useCallback(
    (schedule: Partial<SessionPlanningSchedule>) => {
      dispatch({ type: "UPDATE_SCHEDULE", payload: schedule });
    },
    [dispatch]
  );

  const updateNotifications = useCallback(
    (notifications: Partial<SessionPlanningNotifications>) => {
      dispatch({ type: "UPDATE_NOTIFICATIONS", payload: notifications });
    },
    [dispatch]
  );

  const markDirty = useCallback(
    (isDirty: boolean) => {
      dispatch({ type: "MARK_DIRTY", payload: isDirty });
    },
    [dispatch]
  );

  const markSaving = useCallback(
    (isSaving: boolean) => {
      dispatch({ type: "MARK_SAVING", payload: isSaving });
    },
    [dispatch]
  );

  const markSaved = useCallback(
    (timestamp?: string) => {
      dispatch({ type: "MARK_SAVED", payload: timestamp });
    },
    [dispatch]
  );

  const reset = useCallback(
    (context?: SessionPlanningEntryContext) => {
      dispatch({ type: "RESET", payload: context });
    },
    [dispatch]
  );

  return {
    loadEntryContext,
    setCurrentStep,
    updateLead,
    updateProject,
    updateSessionType,
    updateSessionFields,
    updateSchedule,
    updateNotifications,
    markDirty,
    markSaving,
    markSaved,
    reset
  };
};

