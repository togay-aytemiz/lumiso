import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface SettingsSectionOptions<T> {
  sectionName: string;
  initialValues: T;
  onSave: (values: T) => Promise<T | void>;
  autoSave?: boolean;
  throttleMs?: number;
  disableToast?: boolean; // New option to disable section-level toasts
}

export function useSettingsSection<T extends Record<string, any>>({
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
  const throttleRef = useRef<NodeJS.Timeout>();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Check if section has unsaved changes
  const isDirty = JSON.stringify(values) !== JSON.stringify(savedValues);

  // Update initial values when they change (e.g., from server)
  useEffect(() => {
    setValues(initialValues);
    setSavedValues(initialValues);
  }, [JSON.stringify(initialValues)]);

  const updateValue = useCallback((key: keyof T, value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [key]: value }));
    
    if (autoSave) {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
      
      throttleRef.current = setTimeout(() => {
        handleSave({ ...values, [key]: value });
      }, throttleMs);
    }
  }, [values, autoSave, throttleMs]);

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
            title: `Updated ${sectionName}`,
            duration: 2000,
          });
        } else {
          // Regular toast for manual save
          toast({
            title: `Saved ${sectionName}`,
            duration: 3000,
          });
        }
      }
    } catch (error) {
      // Always show error toasts
      toast({
        title: "Error",
        description: `Failed to save ${sectionName}. Please try again.`,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [values, onSave, sectionName, autoSave, toast, disableToast]);

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