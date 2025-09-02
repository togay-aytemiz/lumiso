import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useNotificationTriggers() {
  const { toast } = useToast();

  // Trigger project milestone notification
  const triggerProjectMilestone = async (
    projectId: string,
    oldStatus: string,
    newStatus: string,
    organizationId: string,
    assigneeIds: string[] = []
  ) => {
    try {
      console.log(`Triggering milestone notification: ${projectId} (${oldStatus} → ${newStatus})`);

      // Get current user for changed_by_user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user for milestone notification');
        return;
      }

      // Create notification record for each assignee
      const notifications = assigneeIds.map(assigneeId => ({
        organization_id: organizationId,
        user_id: assigneeId,
        notification_type: 'project-milestone',
        delivery_method: 'immediate',
        status: 'pending',
        metadata: {
          project_id: projectId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by_user_id: user.id
        }
      }));

      if (notifications.length === 0) {
        console.log('No assignees for milestone notification');
        return;
      }

      // Insert notification records
      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Error creating milestone notifications:', error);
        throw error;
      }

      console.log(`Created ${notifications.length} milestone notification records`);

      // Trigger immediate processing
      await supabase.functions.invoke('notification-processor', {
        body: {
          action: 'process-pending',
          organizationId: organizationId
        }
      });

    } catch (error: any) {
      console.error('Error in triggerProjectMilestone:', error);
      toast({
        title: "Notification Error",
        description: "Failed to send milestone notification",
        variant: "destructive",
      });
    }
  };

  // Trigger new assignment notification
  const triggerNewAssignment = async (
    entityType: 'lead' | 'project',
    entityId: string,
    assigneeIds: string[],
    organizationId: string,
    assignerName?: string
  ) => {
    try {
      console.log(`Triggering assignment notification: ${entityType}:${entityId} to ${assigneeIds.length} users`);

      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user for assignment notification');
        return;
      }

      // Get assigner name if not provided
      if (!assignerName) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        assignerName = profile?.full_name || user.email?.split('@')[0] || 'Someone';
      }

      // Create notification record for each assignee
      const notifications = assigneeIds.map(assigneeId => ({
        organization_id: organizationId,
        user_id: assigneeId,
        notification_type: 'new-assignment',
        delivery_method: 'immediate',
        status: 'pending',
        metadata: {
          entity_type: entityType,
          entity_id: entityId,
          assigner_id: user.id,
          assigner_name: assignerName
        }
      }));

      // Insert notification records
      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Error creating assignment notifications:', error);
        throw error;
      }

      console.log(`Created ${notifications.length} assignment notification records`);

      // Trigger immediate processing
      await supabase.functions.invoke('notification-processor', {
        body: {
          action: 'process-pending',
          organizationId: organizationId
        }
      });

    } catch (error: any) {
      console.error('Error in triggerNewAssignment:', error);
      toast({
        title: "Notification Error",
        description: "Failed to send assignment notification",
        variant: "destructive",
      });
    }
  };

  // Schedule daily summary notifications for tomorrow
  const scheduleDailySummaries = async (organizationId?: string) => {
    try {
      console.log('Scheduling daily summary notifications');

      const { error } = await supabase.functions.invoke('notification-processor', {
        body: {
          action: 'schedule-notification',
          organizationId: organizationId
        }
      });

      if (error) {
        console.error('Error scheduling daily summaries:', error);
        throw error;
      }

      console.log('Daily summaries scheduled successfully');

    } catch (error: any) {
      console.error('Error in scheduleDailySummaries:', error);
      toast({
        title: "Scheduling Error",
        description: "Failed to schedule daily summaries",
        variant: "destructive",
      });
    }
  };

  // Process pending notifications manually
  const processPendingNotifications = async (organizationId?: string) => {
    try {
      console.log('Processing pending notifications');

      const { data, error } = await supabase.functions.invoke('notification-processor', {
        body: {
          action: 'process-pending',
          organizationId: organizationId,
          force: true
        }
      });

      if (error) {
        console.error('Error processing notifications:', error);
        throw error;
      }

      console.log('Processed notifications:', data);
      
      toast({
        title: "Success",
        description: `Processed ${data?.result?.processed || 0} notifications`,
      });

    } catch (error: any) {
      console.error('Error in processPendingNotifications:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process notifications",
        variant: "destructive",
      });
    }
  };

  // Retry failed notifications
  const retryFailedNotifications = async (organizationId?: string) => {
    try {
      console.log('Retrying failed notifications');

      const { data, error } = await supabase.functions.invoke('notification-processor', {
        body: {
          action: 'retry-failed',
          organizationId: organizationId
        }
      });

      if (error) {
        console.error('Error retrying notifications:', error);
        throw error;
      }

      console.log('Retried notifications:', data);
      
      toast({
        title: "Success",
        description: `Retried ${data?.result?.retried_count || 0} failed notifications`,
      });

    } catch (error: any) {
      console.error('Error in retryFailedNotifications:', error);
      toast({
        title: "Retry Error",
        description: "Failed to retry notifications",
        variant: "destructive",
      });
    }
  };

  return {
    triggerProjectMilestone,
    triggerNewAssignment,
    scheduleDailySummaries,
    processPendingNotifications,
    retryFailedNotifications
  };
}