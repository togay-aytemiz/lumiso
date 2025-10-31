import { useCallback } from "react";
import { usePackageCreationContext } from "./usePackageCreationContext";
import {
  PackageCreationBasics,
  PackageCreationDeliveryState,
  PackageCreationEntryContext,
  PackageCreationHydrationPayload,
  PackageCreationPricingState,
  PackageCreationServicesState,
  PackageCreationStepId,
} from "../types";

export const usePackageCreationActions = () => {
  const { dispatch } = usePackageCreationContext();

  const loadEntryContext = useCallback(
    (context: PackageCreationEntryContext) => {
      dispatch({ type: "LOAD_ENTRY_CONTEXT", payload: context });
    },
    [dispatch]
  );

  const setCurrentStep = useCallback(
    (step: PackageCreationStepId) => {
      dispatch({ type: "SET_STEP", payload: step });
    },
    [dispatch]
  );

  const updateBasics = useCallback(
    (basics: Partial<PackageCreationBasics>, options?: { markDirty?: boolean }) => {
      dispatch({
        type: "UPDATE_BASICS",
        payload: basics,
        markDirty: options?.markDirty,
      });
    },
    [dispatch]
  );

  const updateServices = useCallback(
    (services: Partial<PackageCreationServicesState>, options?: { markDirty?: boolean }) => {
      dispatch({
        type: "UPDATE_SERVICES",
        payload: services,
        markDirty: options?.markDirty,
      });
    },
    [dispatch]
  );

  const updateDelivery = useCallback(
    (delivery: Partial<PackageCreationDeliveryState>, options?: { markDirty?: boolean }) => {
      dispatch({
        type: "UPDATE_DELIVERY",
        payload: delivery,
        markDirty: options?.markDirty,
      });
    },
    [dispatch]
  );

  const updatePricing = useCallback(
    (pricing: Partial<PackageCreationPricingState>, options?: { markDirty?: boolean }) => {
      dispatch({
        type: "UPDATE_PRICING",
        payload: pricing,
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
    (context?: PackageCreationEntryContext) => {
      dispatch({ type: "RESET", payload: context });
    },
    [dispatch]
  );

  const hydrate = useCallback(
    (payload: PackageCreationHydrationPayload) => {
      dispatch({ type: "HYDRATE_STATE", payload });
    },
    [dispatch]
  );

  return {
    loadEntryContext,
    setCurrentStep,
    updateBasics,
    updateServices,
    updateDelivery,
    updatePricing,
    markDirty,
    reset,
    hydrate,
  };
};
