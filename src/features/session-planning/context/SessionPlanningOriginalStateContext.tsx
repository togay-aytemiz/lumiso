import { createContext, useContext } from "react";
import type { SessionPlanningState } from "../types";

const SessionPlanningOriginalStateContext = createContext<SessionPlanningState | null>(null);

export const SessionPlanningOriginalStateProvider = SessionPlanningOriginalStateContext.Provider;

export const useSessionPlanningOriginalState = () =>
  useContext(SessionPlanningOriginalStateContext);
