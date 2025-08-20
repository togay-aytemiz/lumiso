import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to get lifecycle for any status type
 * Returns 'active', 'completed', 'cancelled', or 'active' as fallback
 */
export function useStatusLifecycle(statusTable: 'lead_statuses' | 'project_statuses' | 'session_statuses', statusId: string | null) {
  return useQuery({
    queryKey: ['status-lifecycle', statusTable, statusId],
    queryFn: async () => {
      if (!statusId) return 'active';
      
      const { data, error } = await supabase.rpc('get_status_lifecycle', {
        status_table: statusTable,
        status_id: statusId
      });
      
      if (error) {
        console.error('Error fetching lifecycle:', error);
        return 'active';
      }
      
      return data || 'active';
    },
    enabled: !!statusId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Convenience hooks for specific entity types
 */
export function useLeadLifecycle(statusId: string | null) {
  return useStatusLifecycle('lead_statuses', statusId);
}

export function useProjectLifecycle(statusId: string | null) {
  return useStatusLifecycle('project_statuses', statusId);
}

export function useSessionLifecycle(statusId: string | null) {
  return useStatusLifecycle('session_statuses', statusId);
}

/**
 * Utility function to get lifecycle badge variant
 */
export function getLifecycleBadgeVariant(lifecycle: string): 'default' | 'secondary' | 'destructive' {
  switch (lifecycle) {
    case 'completed':
      return 'secondary'; // Green-ish
    case 'cancelled':
      return 'destructive'; // Red-ish
    case 'active':
    default:
      return 'default'; // Default styling
  }
}

/**
 * Utility function to check if a lifecycle represents completion
 */
export function isLifecycleComplete(lifecycle: string): boolean {
  return lifecycle === 'completed' || lifecycle === 'cancelled';
}

/**
 * Utility function to check if a lifecycle is active/in-progress
 */
export function isLifecycleActive(lifecycle: string): boolean {
  return lifecycle === 'active';
}