import { useEffect } from "react";
import { useSettingsSection } from "./useSettingsSection";
import { useSettingsContext } from "@/contexts/SettingsContext";

interface SettingsSectionWithContextOptions<T> {
  sectionId: string;
  sectionName: string;
  initialValues: T;
  onSave: (values: T) => Promise<void>;
  autoSave?: boolean;
  throttleMs?: number;
}

export function useSettingsSectionWithContext<T extends Record<string, any>>(
  options: SettingsSectionWithContextOptions<T>
) {
  const { addDirtySection, removeDirtySection } = useSettingsContext();
  const section = useSettingsSection(options);

  // Track dirty state in context
  useEffect(() => {
    if (section.isDirty) {
      addDirtySection(options.sectionId);
    } else {
      removeDirtySection(options.sectionId);
    }
  }, [section.isDirty, options.sectionId, addDirtySection, removeDirtySection]);

  // Override handleSave to update context
  const handleSave = async () => {
    await section.handleSave();
    removeDirtySection(options.sectionId);
  };

  // Override handleCancel to update context
  const handleCancel = () => {
    section.handleCancel();
    removeDirtySection(options.sectionId);
  };

  return {
    ...section,
    handleSave,
    handleCancel
  };
}