import { createContext, ReactNode, useMemo, useReducer } from "react";
import { projectCreationReducer, createInitialProjectCreationState } from "../state/projectCreationReducer";
import { ProjectCreationAction, ProjectCreationEntryContext, ProjectCreationState } from "../types";

interface ProjectCreationContextValue {
  state: ProjectCreationState;
  dispatch: React.Dispatch<ProjectCreationAction>;
}

export const ProjectCreationContext = createContext<ProjectCreationContextValue | undefined>(undefined);

interface ProjectCreationProviderProps {
  children: ReactNode;
  entryContext?: ProjectCreationEntryContext;
}

export const ProjectCreationProvider = ({ children, entryContext }: ProjectCreationProviderProps) => {
  const [state, dispatch] = useReducer(projectCreationReducer, createInitialProjectCreationState(entryContext));

  const value = useMemo(
    () => ({
      state,
      dispatch,
    }),
    [state]
  );

  return <ProjectCreationContext.Provider value={value}>{children}</ProjectCreationContext.Provider>;
};
