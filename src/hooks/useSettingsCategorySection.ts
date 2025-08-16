import { useEffect, useCallback, useRef } from "react";
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

  // Use refs to avoid recreating functions
  const handlersRef = useRef({
    handleSave: section.handleSave,
    handleCancel: section.handleCancel
  });

  // Update refs when handlers change
  useEffect(() => {
    handlersRef.current = {
      handleSave: async () => {
        await section.handleSave();
        // Clear file selection after successful save to reset the state
        setTimeout(() => {
          if (section.values.logoFile) {
            section.updateValue("logoFile", null);
          }
        }, 100);
      },
      handleCancel: () => {
        section.handleCancel();
        // Also clear file selection on cancel
        if (section.values.logoFile) {
          section.updateValue("logoFile", null);
        }
      }
    };
  }, [section.handleSave, section.handleCancel, section.values, section.updateValue]);

  // Register this section with the category context - only when path/id changes
  useEffect(() => {
    registerSectionHandler(
      categoryPath,
      options.sectionId,
      options.sectionName,
      () => handlersRef.current.handleSave(),
      () => handlersRef.current.handleCancel()
    );

    return () => {
      unregisterSectionHandler(categoryPath, options.sectionId);
    };
  }, [categoryPath, options.sectionId, options.sectionName]); // Removed handler deps

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