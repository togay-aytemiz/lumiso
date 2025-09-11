import { useSessionStatuses } from "@/hooks/useOrganizationData";

export interface SessionWithStatus {
  id: string;
  session_date: string;
  session_time?: string;
  notes?: string;
  status: string;
  status_id?: string | null;
  project_id?: string;
  lead_id: string;
  session_statuses?: {
    id: string;
    name: string;
    lifecycle: string;
  } | null;
  projects?: {
    name: string;
    project_types?: {
      name: string;
    };
  };
}

/**
 * Get lifecycle priority for sorting
 * Active sessions get priority 1 (shown first)
 * Completed sessions get priority 2 (shown second)  
 * Cancelled sessions get priority 3 (shown last)
 */
function getLifecyclePriority(lifecycle?: string): number {
  switch (lifecycle) {
    case 'active':
      return 1;
    case 'completed':
      return 2;
    case 'cancelled':
      return 3;
    default:
      return 1; // Default to active priority
  }
}

/**
 * Smart session sorting function that uses dynamic lifecycle detection
 * 
 * Sorting Logic:
 * 1. Group by lifecycle priority (active -> completed -> cancelled)
 * 2. Within active sessions: sort by date/time ascending (soonest first)
 * 3. Within completed/cancelled: sort by date/time descending (most recent first)
 */
export function sortSessionsByLifecycle(sessions: SessionWithStatus[]): SessionWithStatus[] {
  return [...sessions].sort((a, b) => {
    // Get lifecycle from status relationship or fallback to legacy status string
    const lifecycleA = a.session_statuses?.lifecycle || getLegacyLifecycle(a.status);
    const lifecycleB = b.session_statuses?.lifecycle || getLegacyLifecycle(b.status);
    
    // Primary sort: by lifecycle priority
    const priorityA = getLifecyclePriority(lifecycleA);
    const priorityB = getLifecyclePriority(lifecycleB);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Secondary sort: by date/time within same lifecycle group
    const dateA = new Date(`${a.session_date}T${a.session_time || '00:00'}`);
    const dateB = new Date(`${b.session_date}T${b.session_time || '00:00'}`);
    
    // For active sessions: soonest first (ascending)
    // For completed/cancelled: most recent first (descending)
    if (lifecycleA === 'active') {
      return dateA.getTime() - dateB.getTime(); // Ascending
    } else {
      return dateB.getTime() - dateA.getTime(); // Descending
    }
  });
}

/**
 * Legacy status mapping for backward compatibility
 * Maps old status strings to lifecycle categories
 */
function getLegacyLifecycle(status: string): string {
  const statusLower = status.toLowerCase();
  
  // Active statuses
  if (['planned', 'confirmed', 'scheduled', 'editing', 'in_progress'].includes(statusLower)) {
    return 'active';
  }
  
  // Completed statuses
  if (['completed', 'delivered', 'in_post_processing'].includes(statusLower)) {
    return 'completed';
  }
  
  // Cancelled statuses
  if (['cancelled', 'no_show', 'archived'].includes(statusLower)) {
    return 'cancelled';
  }
  
  // Default to active for unknown statuses
  return 'active';
}

/**
 * Get session query with status information
 * This ensures we fetch the necessary data for lifecycle-aware sorting
 */
export const getSessionQueryWithStatus = () => {
  return `
    *,
    session_statuses:status_id (
      id,
      name,
      lifecycle
    ),
    projects:project_id (
      name,
      project_types (
        name
      )
    )
  `;
};