import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAssignmentNotifications = () => {
  const sendPendingNotifications = useCallback(async (entityType: 'lead' | 'project', entityId: string) => {
    try {
      // Get pending notifications for this organization
      const { data: pendingNotifications, error: fetchError } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('notification_type', 'new-assignment')
        .eq('status', 'pending')
        .gte('sent_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Last 2 minutes
        .order('sent_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching pending notifications:', fetchError);
        return;
      }

      if (!pendingNotifications || pendingNotifications.length === 0) {
        return;
      }

      // Get current user info for assigner name
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', currentUser?.id)
        .maybeSingle();

      // Process each pending notification
      for (const notification of pendingNotifications) {
        try {
          // Get the assignee's profile
          const { data: assigneeProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', notification.user_id)
            .maybeSingle();

          // Call the edge function to send the notification
          const { error: sendError } = await supabase.functions.invoke('send-reminder-notifications', {
            body: {
              type: 'new-assignment',
              entity_type: entityType,
              entity_id: entityId,
              assignee_id: notification.user_id,
              assignee_email: '', // Will be fetched in the edge function
              assignee_name: assigneeProfile?.full_name || 'User',
              assigner_name: currentProfile?.full_name || currentUser?.email?.split('@')[0],
              organizationId: notification.organization_id
            }
          });

          if (sendError) {
            console.error('Error sending notification:', sendError);
            // Update status to failed
            await supabase
              .from('notification_logs')
              .update({ status: 'failed', sent_at: new Date().toISOString() })
              .eq('id', notification.id);
          } else {
            // Update status to sent
            await supabase
              .from('notification_logs')
              .update({ status: 'success', sent_at: new Date().toISOString() })
              .eq('id', notification.id);
          }
        } catch (error) {
          console.error('Error processing notification:', notification.id, error);
        }
      }
    } catch (error) {
      console.error('Error in sendPendingNotifications:', error);
    }
  }, []);

  return {
    sendPendingNotifications
  };
};