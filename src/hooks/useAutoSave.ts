import { useCallback, useEffect, useRef } from "react";
import { useDebounce } from "./useDebounce";

interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
}

/**
 * Custom hook for auto-saving data with debouncing
 * @param data - The data to save
 * @param saveFunction - The function to call to save the data
 * @param options - Configuration options
 */
export function useAutoSave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  options: UseAutoSaveOptions = {}
) {
  const { delay = 2000, enabled = true } = options;
  const debouncedData = useDebounce(data, delay);
  const initialLoad = useRef(true);

  const save = useCallback(async () => {
    if (!enabled) return;
    
    try {
      await saveFunction(debouncedData);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [debouncedData, saveFunction, enabled]);

  useEffect(() => {
    // Skip the first effect run (initial load)
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    save();
  }, [save]);

  return { save };
}