import { createContext, ReactNode, useMemo, useReducer } from "react";
import { sessionPlanningReducer, createInitialSessionPlanningState } from "../state/sessionPlanningReducer";
import { SessionPlanningAction, SessionPlanningEntryContext, SessionPlanningState } from "../types";

interface SessionPlanningContextValue {
  state: SessionPlanningState;
  dispatch: React.Dispatch<SessionPlanningAction>;
}

export const SessionPlanningContext = createContext<SessionPlanningContextValue | undefined>(undefined);

interface SessionPlanningProviderProps {
  children: ReactNode;
  entryContext?: SessionPlanningEntryContext;
}

export const SessionPlanningProvider = ({ children, entryContext }: SessionPlanningProviderProps) => {
  const [state, dispatch] = useReducer(
    sessionPlanningReducer,
    createInitialSessionPlanningState(entryContext)
  );

  const value = useMemo(
    () => ({
      state,
      dispatch
    }),
    [state]
  );

  return <SessionPlanningContext.Provider value={value}>{children}</SessionPlanningContext.Provider>;
};

