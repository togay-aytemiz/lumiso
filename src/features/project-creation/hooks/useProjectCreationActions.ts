import { useCallback } from "react";
import { useProjectCreationContext } from "./useProjectCreationContext";
import {
  ProjectCreationDelivery,
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
    (lead: ProjectCreationLead, options?: { markDirty?: boolean }) => {
      dispatch({
        type: "UPDATE_LEAD",
        payload: lead,
        markDirty: options?.markDirty,
      });
    },
    [dispatch]
  );

  const updateDetails = useCallback(
    (
      details: Partial<ProjectCreationDetails>,
      options?: { markDirty?: boolean }
    ) => {
      dispatch({
        type: "UPDATE_DETAILS",
        payload: details,
        markDirty: options?.markDirty,
      });
    },
    [dispatch]
  );

  const updateServices = useCallback(
    (
      services: Partial<ProjectCreationServices>,
      options?: { markDirty?: boolean }
    ) => {
      dispatch({
        type: "UPDATE_SERVICES",
        payload: services,
        markDirty: options?.markDirty,
      });
    },
    [dispatch]
  );

  const updateDelivery = useCallback(
    (
      delivery: Partial<ProjectCreationDelivery>,
      options?: { markDirty?: boolean }
    ) => {
      dispatch({
        type: "UPDATE_DELIVERY",
        payload: delivery,
        markDirty: options?.markDirty,
      });
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
    updateDelivery,
    markDirty,
    reset,
  };
};
