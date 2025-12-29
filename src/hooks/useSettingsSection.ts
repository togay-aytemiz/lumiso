import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface SettingsSectionOptions<T> {
  sectionName: string;
  initialValues: T;
  onSave: (values: T) => Promise<T | void>;
  autoSave?: boolean;
  throttleMs?: number;
  disableToast?: boolean; // New option to disable section-level toasts
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "An unexpected error occurred";
};

export function useSettingsSection<T extends Record<string, unknown>>({
  sectionName,
  initialValues,
  onSave,
  autoSave = false,
  throttleMs = 1000,
  disableToast = false
}: SettingsSectionOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [savedValues, setSavedValues] = useState<T>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation("common");
  const throttleRef = useRef<ReturnType<typeof setTimeout>>();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Check if section has unsaved changes
  const isDirty = JSON.stringify(values) !== JSON.stringify(savedValues);

  const initialValuesSerializedRef = useRef<string>(JSON.stringify(initialValues));

  // Update initial values when they change (e.g., from server)
  useEffect(() => {
    const serialized = JSON.stringify(initialValues);
    if (serialized === initialValuesSerializedRef.current) {
      return;
    }
    initialValuesSerializedRef.current = serialized;
    setValues(initialValues);
    setSavedValues(initialValues);
  }, [initialValues]);

  const handleSave = useCallback(async (valuesToSave?: T) => {
    const dataToSave = valuesToSave || values;
    setIsSaving(true);
    
    try {
      const result = await onSave(dataToSave);
      
      // If onSave returns cleaned values, use those; otherwise use original
      const finalValues = result && typeof result === 'object' ? result : dataToSave;
      setSavedValues(finalValues);
      setValues(finalValues); // CRITICAL: Update current values to clear file selections
      
      // Only show toasts if not disabled (for category-based systems)
      if (!disableToast) {
        if (autoSave) {
          // Show inline success indicator for auto-save
          setShowSuccess(true);
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            setShowSuccess(false);
          }, 1000);
          
          // Throttled toast for auto-save to avoid spam
          toast({
            title: t("toast.settingsAutoSavedTitle"),
            description: t("toast.settingsAutoSavedSection", {
              section: sectionName,
            }),
            duration: 2000,
          });
        } else {
          // Regular toast for manual save
          toast({
            title: t("toast.settingsSavedTitle"),
            description: t("toast.settingsSavedCategory", {
              category: sectionName,
            }),
            duration: 3000,
          });
        }
      }
    } catch (error: unknown) {
      // Always show error toasts
      toast({
        title: t("toast.error"),
        description: getErrorMessage(error),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [values, onSave, sectionName, autoSave, toast, disableToast, t]);

  const updateValue = useCallback(
    (key: keyof T, value: T[keyof T]) => {
      setValues(prev => {
        const nextValues = { ...prev, [key]: value };

        if (autoSave) {
          if (throttleRef.current) {
            clearTimeout(throttleRef.current);
          }

          throttleRef.current = setTimeout(() => {
            handleSave(nextValues);
          }, throttleMs);
        }

        return nextValues;
      });
    },
    [autoSave, handleSave, throttleMs]
  );

  const handleCancel = useCallback(() => {
    setValues(savedValues);
  }, [savedValues]);

  const handleReset = useCallback(() => {
    setValues(initialValues);
    setSavedValues(initialValues);
  }, [initialValues]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    values,
    isDirty,
    isSaving,
    showSuccess,
    updateValue,
    handleSave,
    handleCancel,
    handleReset,
    setValues
  };
}
