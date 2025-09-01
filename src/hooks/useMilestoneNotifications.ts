import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useMilestoneNotifications() {
  const { toast } = useToast();

  const sendPendingMilestoneNotifications = async () => {
    try {
      console.log('Sending pending milestone notifications...');

      // Get pending milestone notifications from the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: pendingNotifications, error: notificationError } = await supabase
        .from('notification_logs')
        .select(`
          id,
          user_id,
          organization_id,
          metadata,
          created_at
        `)
        .eq('notification_type', 'project-milestone')
        .eq('status', 'pending')
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false });

      if (notificationError) {
        console.error('Error fetching milestone notifications:', notificationError);
        return;
      }

      if (!pendingNotifications || pendingNotifications.length === 0) {
        console.log('No pending milestone notifications found');
        return;
      }

      console.log(`Found ${pendingNotifications.length} pending milestone notifications`);

      // Group notifications by user to avoid duplicate processing
      const uniqueNotifications = pendingNotifications.reduce((acc, notification) => {
        const key = `${notification.user_id}-${notification.organization_id}`;
        if (!acc[key] || acc[key].created_at < notification.created_at) {
          acc[key] = notification;
        }
        return acc;
      }, {} as Record<string, any>);

      // Process each unique notification by calling the edge function
      for (const notification of Object.values(uniqueNotifications)) {
        try {
          console.log(`Processing milestone notification for user: ${notification.user_id}`);
          
          // Extract project context from metadata
          const metadata = notification.metadata || {};
          const projectId = metadata.project_id;
          const projectName = metadata.project_name;
          const newStatus = metadata.new_status;
          const oldStatus = metadata.old_status;
          const changedByUserId = metadata.changed_by_user_id;

          if (!projectId) {
            console.error('No project_id in notification metadata:', notification);
            continue;
          }

          console.log(`Sending milestone notification for project "${projectName}" (${oldStatus} → ${newStatus}) changed by user ${changedByUserId}`);

          // Invoke the edge function with the complete project context
          const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
            body: {
              type: 'project-milestone',
              project_id: projectId,
              old_status: oldStatus,
              new_status: newStatus,
              changed_by_user_id: changedByUserId,
              organizationId: notification.organization_id,
            }
          });

          if (error) {
            console.error('Error sending milestone notification:', error);
          } else {
            console.log('Milestone notification sent successfully:', data);
          }

        } catch (notificationError) {
          console.error('Error processing milestone notification:', notificationError);
        }
      }

    } catch (error) {
      console.error('Error in sendPendingMilestoneNotifications:', error);
      toast({
        title: "Notification Error",
        description: "Failed to send milestone notifications",
        variant: "destructive",
      });
    }
  };

  return {
    sendPendingMilestoneNotifications
  };
}