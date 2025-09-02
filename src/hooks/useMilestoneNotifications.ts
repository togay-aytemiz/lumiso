import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";

export function useMilestoneNotifications() {
  const { triggerProjectMilestone } = useNotificationTriggers();

  const sendPendingMilestoneNotifications = async () => {
    console.log('Legacy milestone notification method called - please use triggerProjectMilestone directly');
    // This method is deprecated - use triggerProjectMilestone instead
  };

  return {
    sendPendingMilestoneNotifications,
    triggerProjectMilestone // Expose new method
  };
}