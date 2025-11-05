import { createContext, useContext } from "react";
import type { SessionWorkflowCatalog } from "./sessionWorkflowTypes";

export const SessionWorkflowContext = createContext<
  SessionWorkflowCatalog | undefined
>(undefined);

export const useSessionWorkflowCatalog = (): SessionWorkflowCatalog => {
  const context = useContext(SessionWorkflowContext);
  if (!context) {
    throw new Error(
      "useSessionWorkflowCatalog must be used within a SessionWorkflowProvider"
    );
  }
  return context;
};
