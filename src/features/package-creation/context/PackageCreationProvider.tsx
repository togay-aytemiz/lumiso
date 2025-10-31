import { createContext, ReactNode, useMemo, useReducer } from "react";
import { packageCreationReducer, createInitialPackageCreationState } from "../state/packageCreationReducer";
import { PackageCreationAction, PackageCreationEntryContext, PackageCreationState } from "../types";

interface PackageCreationContextValue {
  state: PackageCreationState;
  dispatch: React.Dispatch<PackageCreationAction>;
}

export const PackageCreationContext = createContext<PackageCreationContextValue | undefined>(undefined);

interface PackageCreationProviderProps {
  children: ReactNode;
  entryContext?: PackageCreationEntryContext;
}

export const PackageCreationProvider = ({ children, entryContext }: PackageCreationProviderProps) => {
  const [state, dispatch] = useReducer(
    packageCreationReducer,
    createInitialPackageCreationState(entryContext)
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
    }),
    [state]
  );

  return <PackageCreationContext.Provider value={value}>{children}</PackageCreationContext.Provider>;
};
