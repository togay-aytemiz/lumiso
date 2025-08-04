import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TodoProgress {
  total: number;
  completed: number;
  percentage: number;
}

export const useProjectProgress = (projectId: string, refreshTrigger?: number) => {
  const [progress, setProgress] = useState<TodoProgress>({
    total: 0,
    completed: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchTodoProgress = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('is_completed')
        .eq('project_id', projectId);

      if (error) throw error;

      const todos = data || [];
      const total = todos.length;
      const completed = todos.filter(todo => todo.is_completed).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      setProgress({ total, completed, percentage });
    } catch (error) {
      console.error('Error fetching todo progress:', error);
      setProgress({ total: 0, completed: 0, percentage: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodoProgress();
  }, [projectId, refreshTrigger]);

  return { progress, loading, refetch: fetchTodoProgress };
};