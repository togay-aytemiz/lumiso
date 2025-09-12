import { supabase } from "@/integrations/supabase/client";
import { sendAssignmentNotification, sendMilestoneNotification, getCurrentUserAndOrg } from "./notificationUtils";
import { toast } from "sonner";

/**
 * Test assignment notifications - for development/testing purposes
 */
export async function testAssignmentNotification() {
  try {
    const { userId, orgId } = await getCurrentUserAndOrg();
    
    if (!userId || !orgId) {
      toast.error("User not authenticated or no active organization");
      return;
    }

    // Send a test assignment notification to the current user
    const result = await sendAssignmentNotification({
      type: 'project',
      entity_id: 'test-project-id',
      entity_name: 'Test Project Assignment',
      assignee_ids: [userId],
      assigned_by_id: userId,
      organization_id: orgId,
      action: 'assigned'
    });

    if (result) {
      toast.success("Test assignment notification sent! Check your email.");
    }
  } catch (error) {
    console.error('Test assignment notification failed:', error);
    toast.error("Failed to send test assignment notification");
  }
}

/**
 * Test milestone notifications - for development/testing purposes
 */
export async function testMilestoneNotification() {
  try {
    const { userId, orgId } = await getCurrentUserAndOrg();
    
    if (!userId || !orgId) {
      toast.error("User not authenticated or no active organization");
      return;
    }

    // Send a test milestone notification to the current user
    const result = await sendMilestoneNotification({
      type: 'project',
      entity_id: 'test-project-id',
      entity_name: 'Test Project Milestone',
      old_status: 'In Progress',
      new_status: 'Completed',
      changed_by_id: userId,
      organization_id: orgId,
      assignee_ids: [userId]
    });

    if (result) {
      toast.success("Test milestone notification sent! Check your email.");
    }
  } catch (error) {
    console.error('Test milestone notification failed:', error);
    toast.error("Failed to send test milestone notification");
  }
}

/**
 * Test daily summary notifications - for development/testing purposes
 */
export async function testDailySummaryNotification() {
  try {
    const { userId } = await getCurrentUserAndOrg();
    
    if (!userId) {
      toast.error("User not authenticated");
      return;
    }

    console.log('Sending test daily summary notification...');
    
    const { data, error } = await supabase.functions.invoke('simple-daily-notifications', {
      body: { 
        action: 'test',
        user_id: userId
      }
    });

    if (error) {
      console.error('Test daily summary error:', error);
      toast.error("Failed to send test daily summary");
      return;
    }

    console.log('Test daily summary result:', data);
    toast.success("Test daily summary sent! Check your email.");
  } catch (error) {
    console.error('Test daily summary failed:', error);
    toast.error("Failed to send test daily summary");
  }
}

/**
 * Check notification preferences for current user
 */
export async function checkNotificationPreferences() {
  try {
    const { userId } = await getCurrentUserAndOrg();
    
    if (!userId) {
      toast.error("User not authenticated");
      return;
    }

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select(`
        notification_global_enabled,
        notification_daily_summary_enabled,
        notification_new_assignment_enabled,
        notification_project_milestone_enabled,
        notification_scheduled_time
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching notification preferences:', error);
      toast.error("Failed to check notification preferences");
      return;
    }

    console.log('Current notification preferences:', settings);
    
    const enabledNotifications = [];
    if (settings?.notification_global_enabled) enabledNotifications.push('Global');
    if (settings?.notification_daily_summary_enabled) enabledNotifications.push('Daily Summary');
    if (settings?.notification_new_assignment_enabled) enabledNotifications.push('Assignment');
    if (settings?.notification_project_milestone_enabled) enabledNotifications.push('Milestone');

    if (enabledNotifications.length > 0) {
      toast.success(`Notifications enabled: ${enabledNotifications.join(', ')} (Scheduled: ${settings?.notification_scheduled_time || 'N/A'})`);
    } else {
      toast.warning("All notifications are currently disabled");
    }

    return settings;
  } catch (error) {
    console.error('Check notification preferences failed:', error);
    toast.error("Failed to check notification preferences");
  }
}