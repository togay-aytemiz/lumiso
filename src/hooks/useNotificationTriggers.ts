import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "An unexpected error occurred";
};

export function useNotificationTriggers() {
  const { toast } = useToast();

  // Trigger project milestone notification
  const triggerProjectMilestone = async (
    projectId: string,
    oldStatusId: string,
    newStatusId: string,
    organizationId: string
  ) => {
    try {
      console.log(`Triggering milestone notification: ${projectId} (${oldStatusId} → ${newStatusId})`);

      // Get current user for changed_by_user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user for milestone notification');
        return;
      }

      // Fetch status names from IDs
      const { data: oldStatus } = await supabase
        .from('project_statuses')
        .select('name')
        .eq('id', oldStatusId)
        .single();
        
      const { data: newStatus } = await supabase
        .from('project_statuses')
        .select('name, lifecycle')
        .eq('id', newStatusId)
        .single();

      if (!oldStatus || !newStatus) {
        console.error('Could not fetch status names for milestone notification');
        return;
      }

      // Single photographer mode: notifications disabled, only log intent
      console.log(
        `Milestone change recorded for project ${projectId}: ${oldStatus.name} → ${newStatus.name} (organization ${organizationId})`
      );
    } catch (error: unknown) {
      console.error('Error in triggerProjectMilestone:', error);
      toast({
        title: "Notification Error",
        description: getErrorMessage(error),
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

    } catch (error: unknown) {
      console.error('Error in scheduleDailySummaries:', error);
      toast({
        title: "Scheduling Error",
        description: getErrorMessage(error),
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

    } catch (error: unknown) {
      console.error('Error in processPendingNotifications:', error);
      toast({
        title: "Processing Error",
        description: getErrorMessage(error),
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

    } catch (error: unknown) {
      console.error('Error in retryFailedNotifications:', error);
      toast({
        title: "Retry Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return {
    triggerProjectMilestone,
    scheduleDailySummaries,
    processPendingNotifications,
    retryFailedNotifications
  };
}
