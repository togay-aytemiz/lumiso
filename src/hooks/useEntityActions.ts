import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from "react-i18next";

export interface EntityActionOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

export interface EntityActionState {
  loading: boolean;
  error: string | null;
}

export function useEntityActions() {
  const [actionStates, setActionStates] = useState<Record<string, EntityActionState>>({});
  const { t } = useTranslation(["common", "messages"]);

  const executeAction = useCallback(async <T>(
    actionName: string,
    actionFn: () => Promise<T>,
    options: EntityActionOptions<T> = {}
  ): Promise<T | null> => {
    try {
      setActionStates(prev => ({
        ...prev,
        [actionName]: { loading: true, error: null }
      }));

      const result = await actionFn();

      setActionStates(prev => ({
        ...prev,
        [actionName]: { loading: false, error: null }
      }));

      if (options.successMessage) {
        toast({
          title: t("toast.success", { ns: "common" }),
          description: options.successMessage,
        });
      }

      options.onSuccess?.(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("error.generic", { ns: "messages" });
      
      setActionStates(prev => ({
        ...prev,
        [actionName]: { loading: false, error: errorMessage }
      }));

      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(errorMessage));
      } else {
        toast({
          title: t("toast.error", { ns: "common" }),
          description: options.errorMessage || errorMessage,
          variant: "destructive",
        });
      }

      return null;
    }
  }, [t]);

  const getActionState = useCallback((actionName: string): EntityActionState => {
    return actionStates[actionName] || { loading: false, error: null };
  }, [actionStates]);

  const clearActionState = useCallback((actionName: string) => {
    setActionStates(prev => {
      const newStates = { ...prev };
      delete newStates[actionName];
      return newStates;
    });
  }, []);

  return {
    executeAction,
    getActionState,
    clearActionState
  };
}
