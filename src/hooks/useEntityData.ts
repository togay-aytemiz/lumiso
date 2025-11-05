import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export interface UseEntityDataOptions<T> {
  fetchFn: () => Promise<T[]>;
  onError?: (error: Error) => void;
  dependencies?: ReadonlyArray<unknown>;
}

export interface EntityDataState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refresh: () => void;
}

const EMPTY_DEPENDENCIES: readonly unknown[] = [];

export function useEntityData<T>({
  fetchFn,
  onError,
  dependencies = EMPTY_DEPENDENCIES
}: UseEntityDataOptions<T>): EntityDataState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFn, onError]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData, dependencies]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    refresh
  };
}
