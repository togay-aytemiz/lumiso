import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";

export const useAssignmentNotifications = () => {
  const { triggerNewAssignment } = useNotificationTriggers();

  const sendPendingNotifications = async (entityType: 'lead' | 'project', entityId: string) => {
    console.log('Legacy assignment notification method called - please use triggerNewAssignment directly');
    // This method is deprecated - use triggerNewAssignment instead
  };

  return {
    sendPendingNotifications,
    triggerNewAssignment // Expose new method
  };
};