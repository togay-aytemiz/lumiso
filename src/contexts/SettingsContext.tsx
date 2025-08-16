import { createContext, useContext, useState, ReactNode } from "react";

interface SettingsContextType {
  dirtySections: Set<string>;
  addDirtySection: (section: string) => void;
  removeDirtySection: (section: string) => void;
  clearAllDirtySections: () => void;
  hasDirtySections: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettingsContext must be used within a SettingsProvider");
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());

  const addDirtySection = (section: string) => {
    setDirtySections(prev => new Set(prev).add(section));
  };

  const removeDirtySection = (section: string) => {
    setDirtySections(prev => {
      const newSet = new Set(prev);
      newSet.delete(section);
      return newSet;
    });
  };

  const clearAllDirtySections = () => {
    setDirtySections(new Set());
  };

  const hasDirtySections = dirtySections.size > 0;

  return (
    <SettingsContext.Provider value={{
      dirtySections,
      addDirtySection,
      removeDirtySection,
      clearAllDirtySections,
      hasDirtySections
    }}>
      {children}
    </SettingsContext.Provider>
  );
}