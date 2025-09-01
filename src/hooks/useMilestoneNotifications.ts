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

      // Process each unique notification
      for (const notification of Object.values(uniqueNotifications)) {
        try {
          // Get the user's profile and email
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', notification.user_id)
            .maybeSingle();

          // Get user email from auth
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(notification.user_id);
          
          if (userError || !user?.email) {
            console.error('Error getting user email:', userError);
            continue;
          }

          // Find the project that was updated (this is a simplified approach)
          // In a real scenario, you'd want to store more context in the notification_logs
          const assigneeName = userProfile?.full_name || 
                              user.user_metadata?.full_name || 
                              user.email.split('@')[0];

          // Invoke the edge function to send the milestone notification
          const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
            body: {
              type: 'project-milestone',
              assignee_id: notification.user_id,
              assignee_email: user.email,
              assignee_name: assigneeName,
              organizationId: notification.organization_id,
              // Note: In a real implementation, you'd want to store project details
              // in the notification_logs table when the trigger fires
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