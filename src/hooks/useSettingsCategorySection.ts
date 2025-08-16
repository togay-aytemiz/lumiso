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
        console.log("🎯 Category section handleSave called");
        console.log("📊 Current values before save:", section.values);
        
        await section.handleSave();
        
        console.log("📊 Values after save, before clearing:", section.values);
        
        // Immediately clear file selection after successful save
        if (section.values.logoFile) {
          console.log("🧹 Clearing logoFile from section state");
          section.updateValue("logoFile", null);
        }
        
        console.log("✅ Section save completed");
      },
      handleCancel: () => {
        console.log("❌ Section cancel called");
        section.handleCancel();
        // Also clear file selection on cancel
        if (section.values.logoFile) {
          console.log("🧹 Clearing logoFile on cancel");
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
    console.log(`🔍 Dirty state check for ${options.sectionId}:`, section.isDirty, "logoFile:", !!section.values.logoFile);
    setSectionDirty(categoryPath, options.sectionId, section.isDirty);
  }, [section.isDirty, categoryPath, options.sectionId, setSectionDirty]);

  return {
    ...section,
    // Override save/cancel to prevent section-level actions
    handleSave: () => {}, // Disabled - use category-level save
    handleCancel: () => {} // Disabled - use category-level cancel
  };
}