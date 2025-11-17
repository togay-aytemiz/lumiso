/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";
import type { SessionPlanningState } from "../types";

const SessionPlanningOriginalStateContext = createContext<SessionPlanningState | null>(null);

interface SessionPlanningOriginalStateProviderProps {
  value: SessionPlanningState | null;
  children: ReactNode;
}

export function SessionPlanningOriginalStateProvider({
  value,
  children,
}: SessionPlanningOriginalStateProviderProps) {
  return (
    <SessionPlanningOriginalStateContext.Provider value={value}>
      {children}
    </SessionPlanningOriginalStateContext.Provider>
  );
}

export const useSessionPlanningOriginalState = () =>
  useContext(SessionPlanningOriginalStateContext);
