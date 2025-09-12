import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AssignmentNotificationData {
  type: 'lead' | 'project';
  entity_id: string;
  entity_name: string;
  assignee_ids: string[];
  assigned_by_id: string;
  organization_id: string;
  action: 'assigned' | 'unassigned';
}

interface MilestoneNotificationData {
  type: 'lead' | 'project' | 'session';
  entity_id: string;
  entity_name: string;
  old_status?: string;
  new_status: string;
  changed_by_id: string;
  organization_id: string;
  assignee_ids?: string[];
}

/**
 * Send assignment notifications to team members
 */
export async function sendAssignmentNotification(data: AssignmentNotificationData) {
  try {
    console.log('Sending assignment notification:', data);
    
    const { data: result, error } = await supabase.functions.invoke('assignment-notification', {
      body: data
    });

    if (error) {
      console.error('Assignment notification error:', error);
      toast.error('Failed to send assignment notifications');
      return false;
    }

    console.log('Assignment notification result:', result);
    if (result?.sent > 0) {
      toast.success(`Assignment notifications sent to ${result.sent} team member${result.sent > 1 ? 's' : ''}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error sending assignment notification:', error);
    toast.error('Failed to send assignment notifications');
    return false;
  }
}

/**
 * Send milestone notifications to team members when status changes
 */
export async function sendMilestoneNotification(data: MilestoneNotificationData) {
  try {
    console.log('Sending milestone notification:', data);
    
    const { data: result, error } = await supabase.functions.invoke('milestone-notification', {
      body: data
    });

    if (error) {
      console.error('Milestone notification error:', error);
      toast.error('Failed to send milestone notifications');
      return false;
    }

    console.log('Milestone notification result:', result);
    if (result?.sent > 0) {
      toast.success(`Milestone notifications sent to ${result.sent} team member${result.sent > 1 ? 's' : ''}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error sending milestone notification:', error);
    toast.error('Failed to send milestone notifications');
    return false;
  }
}

/**
 * Get current user and organization for notifications
 */
export async function getCurrentUserAndOrg(): Promise<{ userId: string | null; orgId: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { userId: null, orgId: null };

    // Get active organization from user settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('active_organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    return {
      userId: user.id,
      orgId: settings?.active_organization_id || null
    };
  } catch (error) {
    console.error('Error getting current user and org:', error);
    return { userId: null, orgId: null };
  }
}

/**
 * Detect significant status changes that should trigger notifications
 */
export function isSignificantStatusChange(oldStatus: string | undefined, newStatus: string): boolean {
  if (!oldStatus || oldStatus === newStatus) return false;

  // Normalize status names for comparison
  const normalizeStatus = (status: string) => status.toLowerCase().trim();
  const oldNormalized = normalizeStatus(oldStatus);
  const newNormalized = normalizeStatus(newStatus);

  // Define significant transitions
  const significantTransitions = [
    // Starting work
    { from: ['new', 'planned', 'pending'], to: ['in progress', 'started', 'active', 'confirmed'] },
    // Completion
    { from: ['in progress', 'started', 'active', 'confirmed', 'editing'], to: ['completed', 'delivered', 'done', 'finished'] },
    // Issues
    { from: ['in progress', 'started', 'active'], to: ['on hold', 'cancelled', 'lost', 'failed'] },
    // Important milestones
    { from: ['planned'], to: ['confirmed'] },
    { from: ['confirmed', 'editing'], to: ['delivered'] }
  ];

  return significantTransitions.some(transition => 
    transition.from.some(from => oldNormalized.includes(from)) &&
    transition.to.some(to => newNormalized.includes(to))
  );
}

/**
 * Compare arrays to detect assignment changes
 */
export function getAssignmentChanges(
  oldAssignees: string[] = [], 
  newAssignees: string[] = []
): { added: string[]; removed: string[] } {
  const added = newAssignees.filter(id => !oldAssignees.includes(id));
  const removed = oldAssignees.filter(id => !newAssignees.includes(id));
  
  return { added, removed };
}