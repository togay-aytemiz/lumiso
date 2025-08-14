import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

let statusCache: ProjectStatus[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useProjectStatusCache = () => {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const isStale = () => {
    return !statusCache || (Date.now() - cacheTimestamp) > CACHE_DURATION;
  };

  const fetchStatuses = useCallback(async () => {
    // Return cached data if still fresh
    if (!isStale()) {
      setStatuses(statusCache!);
      setLoading(false);
      return statusCache!;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('project_statuses')
        .select('id, name, color, sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const freshStatuses = data || [];
      
      // Update cache
      statusCache = freshStatuses;
      cacheTimestamp = Date.now();
      
      setStatuses(freshStatuses);
      return freshStatuses;
    } catch (error) {
      console.error('Error fetching project statuses:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getActiveStatuses = useCallback(() => {
    return statuses.filter(s => s.name?.toLowerCase() !== 'archived');
  }, [statuses]);

  const getArchivedStatus = useCallback(() => {
    return statuses.find(s => s.name?.toLowerCase() === 'archived');
  }, [statuses]);

  const invalidateCache = useCallback(() => {
    statusCache = null;
    cacheTimestamp = 0;
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  return {
    statuses,
    loading,
    fetchStatuses,
    getActiveStatuses,
    getArchivedStatus,
    invalidateCache,
    isCached: !isStale()
  };
};