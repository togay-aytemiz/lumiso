import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface CategoryChanges {
  [sectionId: string]: {
    sectionName: string;
    isDirty: boolean;
    saveHandler: () => Promise<void>;
    cancelHandler: () => void;
  };
}

interface SettingsContextType {
  dirtySections: Set<string>;
  addDirtySection: (section: string) => void;
  removeDirtySection: (section: string) => void;
  clearAllDirtySections: () => void;
  hasDirtySections: boolean;
  // New category-based management
  categoryChanges: { [categoryPath: string]: CategoryChanges };
  registerSectionHandler: (categoryPath: string, sectionId: string, sectionName: string, saveHandler: () => Promise<void>, cancelHandler: () => void) => void;
  unregisterSectionHandler: (categoryPath: string, sectionId: string) => void;
  setSectionDirty: (categoryPath: string, sectionId: string, isDirty: boolean) => void;
  getCategoryDirtySections: (categoryPath: string) => string[];
  hasCategoryChanges: (categoryPath: string) => boolean;
  saveCategoryChanges: (categoryPath: string) => Promise<void>;
  cancelCategoryChanges: (categoryPath: string) => void;
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
  const [categoryChanges, setCategoryChanges] = useState<{ [categoryPath: string]: CategoryChanges }>({});

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

  const registerSectionHandler = useCallback((
    categoryPath: string, 
    sectionId: string, 
    sectionName: string, 
    saveHandler: () => Promise<void>, 
    cancelHandler: () => void
  ) => {
    setCategoryChanges(prev => ({
      ...prev,
      [categoryPath]: {
        ...prev[categoryPath],
        [sectionId]: {
          sectionName,
          isDirty: false,
          saveHandler,
          cancelHandler
        }
      }
    }));
  }, []);

  const unregisterSectionHandler = useCallback((categoryPath: string, sectionId: string) => {
    setCategoryChanges(prev => {
      const newCategory = { ...prev[categoryPath] };
      delete newCategory[sectionId];
      return {
        ...prev,
        [categoryPath]: newCategory
      };
    });
  }, []);

  const setSectionDirty = useCallback((categoryPath: string, sectionId: string, isDirty: boolean) => {
    setCategoryChanges(prev => {
      const section = prev[categoryPath]?.[sectionId];
      if (!section) return prev;
      
      return {
        ...prev,
        [categoryPath]: {
          ...prev[categoryPath],
          [sectionId]: {
            ...section,
            isDirty
          }
        }
      };
    });
  }, []);

  const getCategoryDirtySections = useCallback((categoryPath: string) => {
    const sections = categoryChanges[categoryPath] || {};
    return Object.keys(sections).filter(sectionId => sections[sectionId].isDirty);
  }, [categoryChanges]);

  const hasCategoryChanges = useCallback((categoryPath: string) => {
    return getCategoryDirtySections(categoryPath).length > 0;
  }, [getCategoryDirtySections]);

  const saveCategoryChanges = useCallback(async (categoryPath: string) => {
    const sections = categoryChanges[categoryPath] || {};
    const dirtySections = Object.entries(sections).filter(([_, section]) => section.isDirty);
    
    for (const [sectionId, section] of dirtySections) {
      await section.saveHandler();
      setSectionDirty(categoryPath, sectionId, false);
    }
  }, [categoryChanges, setSectionDirty]);

  const cancelCategoryChanges = useCallback((categoryPath: string) => {
    const sections = categoryChanges[categoryPath] || {};
    const dirtySections = Object.entries(sections).filter(([_, section]) => section.isDirty);
    
    for (const [sectionId, section] of dirtySections) {
      section.cancelHandler();
      setSectionDirty(categoryPath, sectionId, false);
    }
  }, [categoryChanges, setSectionDirty]);

  return (
    <SettingsContext.Provider value={{
      dirtySections,
      addDirtySection,
      removeDirtySection,
      clearAllDirtySections,
      hasDirtySections,
      categoryChanges,
      registerSectionHandler,
      unregisterSectionHandler,
      setSectionDirty,
      getCategoryDirtySections,
      hasCategoryChanges,
      saveCategoryChanges,
      cancelCategoryChanges
    }}>
      {children}
    </SettingsContext.Provider>
  );
}