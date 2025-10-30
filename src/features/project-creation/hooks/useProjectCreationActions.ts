import { useCallback } from "react";
import { useProjectCreationContext } from "./useProjectCreationContext";
import {
  ProjectCreationDetails,
  ProjectCreationEntryContext,
  ProjectCreationLead,
  ProjectCreationServices,
  ProjectCreationStepId,
} from "../types";

export const useProjectCreationActions = () => {
  const { dispatch } = useProjectCreationContext();

  const loadEntryContext = useCallback(
    (context: ProjectCreationEntryContext) => {
      dispatch({ type: "LOAD_ENTRY_CONTEXT", payload: context });
    },
    [dispatch]
  );

  const setCurrentStep = useCallback(
    (step: ProjectCreationStepId) => {
      dispatch({ type: "SET_STEP", payload: step });
    },
    [dispatch]
  );

  const updateLead = useCallback(
    (lead: ProjectCreationLead) => {
      dispatch({ type: "UPDATE_LEAD", payload: lead });
    },
    [dispatch]
  );

  const updateDetails = useCallback(
    (details: Partial<ProjectCreationDetails>) => {
      dispatch({ type: "UPDATE_DETAILS", payload: details });
    },
    [dispatch]
  );

  const updateServices = useCallback(
    (services: Partial<ProjectCreationServices>) => {
      dispatch({ type: "UPDATE_SERVICES", payload: services });
    },
    [dispatch]
  );

  const markDirty = useCallback(
    (isDirty: boolean) => {
      dispatch({ type: "MARK_DIRTY", payload: isDirty });
    },
    [dispatch]
  );

  const reset = useCallback(
    (context?: ProjectCreationEntryContext) => {
      dispatch({ type: "RESET", payload: context });
    },
    [dispatch]
  );

  return {
    loadEntryContext,
    setCurrentStep,
    updateLead,
    updateDetails,
    updateServices,
    markDirty,
    reset,
  };
};
