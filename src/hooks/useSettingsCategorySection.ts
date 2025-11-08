import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSettingsSection } from "./useSettingsSection";
import { useSettingsContext } from "@/contexts/SettingsContext";

interface SettingsCategorySectionOptions<T> {
  sectionId: string;
  sectionName: string;
  initialValues: T;
  onSave: (values: T) => Promise<T | void>;
  autoSave?: boolean;
  throttleMs?: number;
}

export function useSettingsCategorySection<T extends Record<string, unknown>>(
  options: SettingsCategorySectionOptions<T>
) {
  const location = useLocation();
  const categoryPath = location.pathname;
  const { registerSectionHandler, unregisterSectionHandler, setSectionDirty } = useSettingsContext();
  const serializedInitialValues = JSON.stringify(options.initialValues);
  const stableInitialValuesRef = useRef(options.initialValues);
  const serializedRef = useRef(serializedInitialValues);
  const autoSaveEnabled = Boolean(options.autoSave);
  const shouldRegisterWithCategory = !autoSaveEnabled;
  const resolvedThrottleMs = autoSaveEnabled
    ? options.throttleMs ?? 0
    : options.throttleMs;

  if (serializedRef.current !== serializedInitialValues) {
    serializedRef.current = serializedInitialValues;
    stableInitialValuesRef.current = options.initialValues;
  }
  
  const section = useSettingsSection({
    sectionName: options.sectionName,
    initialValues: stableInitialValuesRef.current,
    onSave: options.onSave,
    autoSave: options.autoSave,
    throttleMs: resolvedThrottleMs,
    disableToast: !autoSaveEnabled // Auto-save sections should surface their own toasts
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
  }, [section]);

  // Register this section with the category context - only when path/id changes
  useEffect(() => {
    if (!shouldRegisterWithCategory) {
      return;
    }

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
  }, [
    categoryPath,
    options.sectionId,
    options.sectionName,
    registerSectionHandler,
    unregisterSectionHandler,
    shouldRegisterWithCategory,
  ]);

  // Update dirty state in context
  useEffect(() => {
    if (!shouldRegisterWithCategory) {
      return;
    }

    console.log(`🔍 Dirty state check for ${options.sectionId}:`, section.isDirty, "logoFile:", !!section.values.logoFile);
    setSectionDirty(categoryPath, options.sectionId, section.isDirty);
  }, [
    section.isDirty,
    section.values.logoFile,
    categoryPath,
    options.sectionId,
    setSectionDirty,
    shouldRegisterWithCategory,
  ]);

  return {
    ...section,
    // Override save/cancel to prevent section-level actions
    handleSave: () => {}, // Disabled - use category-level save
    handleCancel: () => {} // Disabled - use category-level cancel
  };
}
