import { useState, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Check } from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useToast } from "@/hooks/use-toast";

interface NotificationSettings {
  // Reminders & Deadlines
  overdueReminderEnabled: boolean;
  deliveryReminderEnabled: boolean;
  deliveryReminderSendAt: string;
  sessionReminderEnabled: boolean;
  sessionReminderSendAt: string;
  
  // Tasks & Todos
  dailySummaryEnabled: boolean;
  dailySummarySendAt: string;
  taskNudgeEnabled: boolean;
  
  // System Alerts
  integrationFailureAlertEnabled: boolean;
  teamInviteAcceptedAlertEnabled: boolean;
}

export default function Notifications() {
  const { settings, loading, updateSettings } = useUserSettings();
  const { toast } = useToast();
  const [autoSaveStates, setAutoSaveStates] = useState<{[key: string]: 'idle' | 'saving' | 'success'}>({});

  // Get notification settings with defaults
  const getNotificationSettings = (): NotificationSettings => ({
    overdueReminderEnabled: settings?.notification_overdue_reminder_enabled ?? false,
    deliveryReminderEnabled: settings?.notification_delivery_reminder_enabled ?? false,
    deliveryReminderSendAt: settings?.notification_delivery_reminder_send_at ?? "09:00",
    sessionReminderEnabled: settings?.notification_session_reminder_enabled ?? false,
    sessionReminderSendAt: settings?.notification_session_reminder_send_at ?? "09:00",
    dailySummaryEnabled: settings?.notification_daily_summary_enabled ?? false,
    dailySummarySendAt: settings?.notification_daily_summary_send_at ?? "07:00",
    taskNudgeEnabled: settings?.notification_task_nudge_enabled ?? false,
    integrationFailureAlertEnabled: settings?.notification_integration_failure_alert_enabled ?? true,
    teamInviteAcceptedAlertEnabled: settings?.notification_team_invite_accepted_alert_enabled ?? false,
  });

  // Reminders & Deadlines section (global save for time groups)
  const remindersSection = useSettingsCategorySection({
    sectionId: "reminders",
    sectionName: "Reminders & Deadlines",
    initialValues: {
      deliveryReminderEnabled: getNotificationSettings().deliveryReminderEnabled,
      deliveryReminderSendAt: getNotificationSettings().deliveryReminderSendAt,
      sessionReminderEnabled: getNotificationSettings().sessionReminderEnabled,
      sessionReminderSendAt: getNotificationSettings().sessionReminderSendAt,
    },
    onSave: async (values) => {
      const updates = {
        notification_delivery_reminder_enabled: values.deliveryReminderEnabled,
        notification_delivery_reminder_send_at: values.deliveryReminderEnabled ? values.deliveryReminderSendAt : "09:00",
        notification_session_reminder_enabled: values.sessionReminderEnabled,
        notification_session_reminder_send_at: values.sessionReminderEnabled ? values.sessionReminderSendAt : "09:00",
      };

      const result = await updateSettings(updates);
      if (!result.success) {
        throw new Error("Failed to save reminder settings");
      }
    }
  });

  // Tasks & Todos section (global save for daily summary)
  const tasksSection = useSettingsCategorySection({
    sectionId: "tasks",
    sectionName: "Tasks & Todos",
    initialValues: {
      dailySummaryEnabled: getNotificationSettings().dailySummaryEnabled,
      dailySummarySendAt: getNotificationSettings().dailySummarySendAt,
    },
    onSave: async (values) => {
      const updates = {
        notification_daily_summary_enabled: values.dailySummaryEnabled,
        notification_daily_summary_send_at: values.dailySummaryEnabled ? values.dailySummarySendAt : "07:00",
      };

      const result = await updateSettings(updates);
      if (!result.success) {
        throw new Error("Failed to save task settings");
      }
    }
  });

  // Auto-save function for pure toggles
  const handleAutoSaveToggle = async (field: string, value: boolean) => {
    setAutoSaveStates(prev => ({ ...prev, [field]: 'saving' }));
    
    const fieldMap: {[key: string]: string} = {
      overdueReminderEnabled: 'notification_overdue_reminder_enabled',
      taskNudgeEnabled: 'notification_task_nudge_enabled',
      integrationFailureAlertEnabled: 'notification_integration_failure_alert_enabled',
      teamInviteAcceptedAlertEnabled: 'notification_team_invite_accepted_alert_enabled',
    };

    try {
      const result = await updateSettings({ [fieldMap[field]]: value });
      if (result.success) {
        setAutoSaveStates(prev => ({ ...prev, [field]: 'success' }));
        toast({
          title: "Updated",
          description: "Notification setting saved successfully",
        });
        
        // Clear success state after 2 seconds
        setTimeout(() => {
          setAutoSaveStates(prev => ({ ...prev, [field]: 'idle' }));
        }, 2000);
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      setAutoSaveStates(prev => ({ ...prev, [field]: 'idle' }));
      toast({
        title: "Error",
        description: "Failed to save notification setting",
        variant: "destructive",
      });
    }
  };

  // Update form values when settings load
  useEffect(() => {
    if (settings) {
      const notificationSettings = getNotificationSettings();
      
      remindersSection.setValues({
        deliveryReminderEnabled: notificationSettings.deliveryReminderEnabled,
        deliveryReminderSendAt: notificationSettings.deliveryReminderSendAt,
        sessionReminderEnabled: notificationSettings.sessionReminderEnabled,
        sessionReminderSendAt: notificationSettings.sessionReminderSendAt,
      });

      tasksSection.setValues({
        dailySummaryEnabled: notificationSettings.dailySummaryEnabled,
        dailySummarySendAt: notificationSettings.dailySummarySendAt,
      });
    }
  }, [settings]);

  // Show loading state until all data is loaded
  if (loading) {
    return (
      <SettingsPageWrapper>
        <SettingsHeader
          title="Notifications"
          description="Configure your notification preferences and delivery times"
        />
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsPageWrapper>
    );
  }

  const notificationSettings = getNotificationSettings();

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Notifications"
        description="Configure your notification preferences and delivery times"
      />
      
      <div className="space-y-8">
        <CategorySettingsSection
          title="Reminders & Deadlines"
          description="Configure automated reminders for important tasks and deadlines"
          sectionId="reminders"
        >
          <div className="space-y-6">
            {/* Overdue Reminder - Pure toggle (auto-save) */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="overdue-reminder" className="text-base font-medium">
                  Overdue Reminder Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Get notified when tasks or deadlines become overdue
                </p>
              </div>
              <div className="flex items-center gap-2">
                {autoSaveStates.overdueReminderEnabled === 'saving' && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {autoSaveStates.overdueReminderEnabled === 'success' && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                <Switch
                  id="overdue-reminder"
                  checked={notificationSettings.overdueReminderEnabled}
                  onCheckedChange={(checked) => handleAutoSaveToggle('overdueReminderEnabled', checked)}
                  disabled={autoSaveStates.overdueReminderEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Delivery Reminder - Time group */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="delivery-reminder" className="text-base font-medium">
                    Delivery Reminder
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Daily reminder to check on delivery status
                  </p>
                </div>
                <Switch
                  id="delivery-reminder"
                  checked={remindersSection.values.deliveryReminderEnabled}
                  onCheckedChange={(checked) => remindersSection.updateValue('deliveryReminderEnabled', checked)}
                />
              </div>
              
              {remindersSection.values.deliveryReminderEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="delivery-time" className="text-sm">Send at:</Label>
                  <Input
                    id="delivery-time"
                    type="time"
                    value={remindersSection.values.deliveryReminderSendAt}
                    onChange={(e) => remindersSection.updateValue('deliveryReminderSendAt', e.target.value)}
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {/* Session Reminder - Time group */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="session-reminder" className="text-base font-medium">
                    Session Reminder
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Daily reminder about upcoming sessions
                  </p>
                </div>
                <Switch
                  id="session-reminder"
                  checked={remindersSection.values.sessionReminderEnabled}
                  onCheckedChange={(checked) => remindersSection.updateValue('sessionReminderEnabled', checked)}
                />
              </div>
              
              {remindersSection.values.sessionReminderEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="session-time" className="text-sm">Send at:</Label>
                  <Input
                    id="session-time"
                    type="time"
                    value={remindersSection.values.sessionReminderSendAt}
                    onChange={(e) => remindersSection.updateValue('sessionReminderSendAt', e.target.value)}
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Tasks & Todos"
          description="Configure notifications for your daily workflow and task management"
          sectionId="tasks"
        >
          <div className="space-y-6">
            {/* Daily Summary - Time group */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="daily-summary" className="text-base font-medium">
                    Daily Summary
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Morning digest of your schedule and pending tasks
                  </p>
                </div>
                <Switch
                  id="daily-summary"
                  checked={tasksSection.values.dailySummaryEnabled}
                  onCheckedChange={(checked) => tasksSection.updateValue('dailySummaryEnabled', checked)}
                />
              </div>
              
              {tasksSection.values.dailySummaryEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="summary-time" className="text-sm">Send at:</Label>
                  <Input
                    id="summary-time"
                    type="time"
                    value={tasksSection.values.dailySummarySendAt}
                    onChange={(e) => tasksSection.updateValue('dailySummarySendAt', e.target.value)}
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {/* Task Nudge - Pure toggle (auto-save) */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="task-nudge" className="text-base font-medium">
                  Task Nudge Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Gentle reminders to complete pending tasks
                </p>
              </div>
              <div className="flex items-center gap-2">
                {autoSaveStates.taskNudgeEnabled === 'saving' && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {autoSaveStates.taskNudgeEnabled === 'success' && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                <Switch
                  id="task-nudge"
                  checked={notificationSettings.taskNudgeEnabled}
                  onCheckedChange={(checked) => handleAutoSaveToggle('taskNudgeEnabled', checked)}
                  disabled={autoSaveStates.taskNudgeEnabled === 'saving'}
                />
              </div>
            </div>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="System Alerts"
          description="Important system notifications and alerts"
          sectionId="system-alerts"
        >
          <div className="space-y-6">
            {/* Integration Failure Alert - Pure toggle (auto-save) */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="integration-failure" className="text-base font-medium">
                  Integration Failure Alerts
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Get notified when integrations fail or experience issues
                </p>
              </div>
              <div className="flex items-center gap-2">
                {autoSaveStates.integrationFailureAlertEnabled === 'saving' && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {autoSaveStates.integrationFailureAlertEnabled === 'success' && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                <Switch
                  id="integration-failure"
                  checked={notificationSettings.integrationFailureAlertEnabled}
                  onCheckedChange={(checked) => handleAutoSaveToggle('integrationFailureAlertEnabled', checked)}
                  disabled={autoSaveStates.integrationFailureAlertEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Team Invite Accepted Alert - Pure toggle (auto-save) */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="team-invite-accepted" className="text-base font-medium">
                  Team Invite Accepted Alerts
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Get notified when team members accept invitations
                </p>
              </div>
              <div className="flex items-center gap-2">
                {autoSaveStates.teamInviteAcceptedAlertEnabled === 'saving' && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {autoSaveStates.teamInviteAcceptedAlertEnabled === 'success' && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                <Switch
                  id="team-invite-accepted"
                  checked={notificationSettings.teamInviteAcceptedAlertEnabled}
                  onCheckedChange={(checked) => handleAutoSaveToggle('teamInviteAcceptedAlertEnabled', checked)}
                  disabled={autoSaveStates.teamInviteAcceptedAlertEnabled === 'saving'}
                />
              </div>
            </div>
          </div>
        </CategorySettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}