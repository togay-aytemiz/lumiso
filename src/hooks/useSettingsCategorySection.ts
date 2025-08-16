import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSettingsSection } from "./useSettingsSection";
import { useSettingsContext } from "@/contexts/SettingsContext";

interface SettingsCategorySectionOptions<T> {
  sectionId: string;
  sectionName: string;
  initialValues: T;
  onSave: (values: T) => Promise<void>;
  autoSave?: boolean;
  throttleMs?: number;
}

export function useSettingsCategorySection<T extends Record<string, any>>(
  options: SettingsCategorySectionOptions<T>
) {
  const location = useLocation();
  const categoryPath = location.pathname;
  const { registerSectionHandler, unregisterSectionHandler, setSectionDirty } = useSettingsContext();
  
  const section = useSettingsSection({
    sectionName: options.sectionName,
    initialValues: options.initialValues,
    onSave: options.onSave,
    autoSave: options.autoSave,
    throttleMs: options.throttleMs
  });

  // Register this section with the category context
  useEffect(() => {
    registerSectionHandler(
      categoryPath,
      options.sectionId,
      options.sectionName,
      section.handleSave,
      section.handleCancel
    );

    return () => {
      unregisterSectionHandler(categoryPath, options.sectionId);
    };
  }, [
    categoryPath,
    options.sectionId,
    options.sectionName,
    section.handleSave,
    section.handleCancel,
    registerSectionHandler,
    unregisterSectionHandler
  ]);

  // Update dirty state in context
  useEffect(() => {
    setSectionDirty(categoryPath, options.sectionId, section.isDirty);
  }, [section.isDirty, categoryPath, options.sectionId, setSectionDirty]);

  return {
    ...section,
    // Override save/cancel to prevent section-level actions
    handleSave: () => {}, // Disabled - use category-level save
    handleCancel: () => {} // Disabled - use category-level cancel
  };
}