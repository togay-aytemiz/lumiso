import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

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
          title: "Success",
          description: options.successMessage,
        });
      }

      options.onSuccess?.(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      
      setActionStates(prev => ({
        ...prev,
        [actionName]: { loading: false, error: errorMessage }
      }));

      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(errorMessage));
      } else {
        toast({
          title: "Error",
          description: options.errorMessage || errorMessage,
          variant: "destructive",
        });
      }

      return null;
    }
  }, []);

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