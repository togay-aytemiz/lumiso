import { useState, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    overdueReminderEnabled: false,
    deliveryReminderEnabled: false,
    deliveryReminderSendAt: "09:00",
    sessionReminderEnabled: false,
    sessionReminderSendAt: "09:00",
    dailySummaryEnabled: false,
    dailySummarySendAt: "07:00",
    taskNudgeEnabled: false,
    integrationFailureAlertEnabled: true,
    teamInviteAcceptedAlertEnabled: false,
  });

  const [autoSaveStates, setAutoSaveStates] = useState<{[key: string]: 'idle' | 'saving' | 'success'}>({});

  // Load settings from database
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        const loadedSettings: NotificationSettings = {
          overdueReminderEnabled: data.notification_overdue_reminder_enabled ?? false,
          deliveryReminderEnabled: data.notification_delivery_reminder_enabled ?? false,
          deliveryReminderSendAt: data.notification_delivery_reminder_send_at ?? "09:00",
          sessionReminderEnabled: data.notification_session_reminder_enabled ?? false,
          sessionReminderSendAt: data.notification_session_reminder_send_at ?? "09:00",
          dailySummaryEnabled: data.notification_daily_summary_enabled ?? false,
          dailySummarySendAt: data.notification_daily_summary_send_at ?? "07:00",
          taskNudgeEnabled: data.notification_task_nudge_enabled ?? false,
          integrationFailureAlertEnabled: data.notification_integration_failure_alert_enabled ?? true,
          teamInviteAcceptedAlertEnabled: data.notification_team_invite_accepted_alert_enabled ?? false,
        };
        setSettings(loadedSettings);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save function for all settings
  const handleAutoSave = async (field: keyof NotificationSettings, value: boolean | string) => {
    setAutoSaveStates(prev => ({ ...prev, [field]: 'saving' }));
    
    const fieldMap: {[key in keyof NotificationSettings]?: string} = {
      overdueReminderEnabled: 'notification_overdue_reminder_enabled',
      deliveryReminderEnabled: 'notification_delivery_reminder_enabled',
      deliveryReminderSendAt: 'notification_delivery_reminder_send_at',
      sessionReminderEnabled: 'notification_session_reminder_enabled',
      sessionReminderSendAt: 'notification_session_reminder_send_at',
      dailySummaryEnabled: 'notification_daily_summary_enabled',
      dailySummarySendAt: 'notification_daily_summary_send_at',
      taskNudgeEnabled: 'notification_task_nudge_enabled',
      integrationFailureAlertEnabled: 'notification_integration_failure_alert_enabled',
      teamInviteAcceptedAlertEnabled: 'notification_team_invite_accepted_alert_enabled',
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const dbField = fieldMap[field];
      if (!dbField) throw new Error('Invalid field');

      const { error } = await supabase
        .from('user_settings')
        .update({ [dbField]: value })
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, [field]: value }));
      setAutoSaveStates(prev => ({ ...prev, [field]: 'success' }));
      
      toast({
        title: "Updated",
        description: "Notification setting saved successfully",
      });
      
      // Clear success state after 2 seconds
      setTimeout(() => {
        setAutoSaveStates(prev => ({ ...prev, [field]: 'idle' }));
      }, 2000);
    } catch (error) {
      console.error('Error saving setting:', error);
      setAutoSaveStates(prev => ({ ...prev, [field]: 'idle' }));
      toast({
        title: "Error",
        description: "Failed to save notification setting",
        variant: "destructive",
      });
    }
  };

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
                  checked={settings.overdueReminderEnabled}
                  onCheckedChange={(checked) => handleAutoSave('overdueReminderEnabled', checked)}
                  disabled={autoSaveStates.overdueReminderEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Delivery Reminder - Auto-save group */}
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
                <div className="flex items-center gap-2">
                  {autoSaveStates.deliveryReminderEnabled === 'saving' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {autoSaveStates.deliveryReminderEnabled === 'success' && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  <Switch
                    id="delivery-reminder"
                    checked={settings.deliveryReminderEnabled}
                    onCheckedChange={(checked) => handleAutoSave('deliveryReminderEnabled', checked)}
                    disabled={autoSaveStates.deliveryReminderEnabled === 'saving'}
                  />
                </div>
              </div>
              
              {settings.deliveryReminderEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="delivery-time" className="text-sm">Send at:</Label>
                  <div className="flex items-center gap-2">
                    {autoSaveStates.deliveryReminderSendAt === 'saving' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {autoSaveStates.deliveryReminderSendAt === 'success' && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    <Input
                      id="delivery-time"
                      type="time"
                      value={settings.deliveryReminderSendAt}
                      onChange={(e) => handleAutoSave('deliveryReminderSendAt', e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Session Reminder - Auto-save group */}
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
                <div className="flex items-center gap-2">
                  {autoSaveStates.sessionReminderEnabled === 'saving' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {autoSaveStates.sessionReminderEnabled === 'success' && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  <Switch
                    id="session-reminder"
                    checked={settings.sessionReminderEnabled}
                    onCheckedChange={(checked) => handleAutoSave('sessionReminderEnabled', checked)}
                    disabled={autoSaveStates.sessionReminderEnabled === 'saving'}
                  />
                </div>
              </div>
              
              {settings.sessionReminderEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="session-time" className="text-sm">Send at:</Label>
                  <div className="flex items-center gap-2">
                    {autoSaveStates.sessionReminderSendAt === 'saving' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {autoSaveStates.sessionReminderSendAt === 'success' && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    <Input
                      id="session-time"
                      type="time"
                      value={settings.sessionReminderSendAt}
                      onChange={(e) => handleAutoSave('sessionReminderSendAt', e.target.value)}
                      className="w-32"
                    />
                  </div>
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
            {/* Daily Summary - Auto-save group */}
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
                <div className="flex items-center gap-2">
                  {autoSaveStates.dailySummaryEnabled === 'saving' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {autoSaveStates.dailySummaryEnabled === 'success' && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  <Switch
                    id="daily-summary"
                    checked={settings.dailySummaryEnabled}
                    onCheckedChange={(checked) => handleAutoSave('dailySummaryEnabled', checked)}
                    disabled={autoSaveStates.dailySummaryEnabled === 'saving'}
                  />
                </div>
              </div>
              
              {settings.dailySummaryEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="summary-time" className="text-sm">Send at:</Label>
                  <div className="flex items-center gap-2">
                    {autoSaveStates.dailySummarySendAt === 'saving' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {autoSaveStates.dailySummarySendAt === 'success' && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    <Input
                      id="summary-time"
                      type="time"
                      value={settings.dailySummarySendAt}
                      onChange={(e) => handleAutoSave('dailySummarySendAt', e.target.value)}
                      className="w-32"
                    />
                  </div>
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
                  checked={settings.taskNudgeEnabled}
                  onCheckedChange={(checked) => handleAutoSave('taskNudgeEnabled', checked)}
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
                  checked={settings.integrationFailureAlertEnabled}
                  onCheckedChange={(checked) => handleAutoSave('integrationFailureAlertEnabled', checked)}
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
                  checked={settings.teamInviteAcceptedAlertEnabled}
                  onCheckedChange={(checked) => handleAutoSave('teamInviteAcceptedAlertEnabled', checked)}
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