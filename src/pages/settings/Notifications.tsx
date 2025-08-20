import { useState, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, TestTube } from "lucide-react";
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
  
  // Business Insights
  weeklyRecapEnabled: boolean;
  weeklyRecapSendAt: string;
  projectMilestoneEnabled: boolean;
  leadConversionEnabled: boolean;
  
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
    weeklyRecapEnabled: false,
    weeklyRecapSendAt: "09:00",
    projectMilestoneEnabled: false,
    leadConversionEnabled: false,
    integrationFailureAlertEnabled: true,
    teamInviteAcceptedAlertEnabled: false,
  });

  const [autoSaveStates, setAutoSaveStates] = useState<{[key: string]: 'idle' | 'saving'}>({});

  // Generate time options every 30 minutes in 24h format
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeValue);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

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
          weeklyRecapEnabled: data.notification_weekly_recap_enabled ?? false,
          weeklyRecapSendAt: data.notification_weekly_recap_send_at ?? "09:00",
          projectMilestoneEnabled: data.notification_project_milestone_enabled ?? false,
          leadConversionEnabled: data.notification_lead_conversion_enabled ?? false,
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
    
    const fieldMap: {[key in keyof NotificationSettings]: string} = {
      overdueReminderEnabled: 'notification_overdue_reminder_enabled',
      deliveryReminderEnabled: 'notification_delivery_reminder_enabled',
      deliveryReminderSendAt: 'notification_delivery_reminder_send_at',
      sessionReminderEnabled: 'notification_session_reminder_enabled',
      sessionReminderSendAt: 'notification_session_reminder_send_at',
      dailySummaryEnabled: 'notification_daily_summary_enabled',
      dailySummarySendAt: 'notification_daily_summary_send_at',
      taskNudgeEnabled: 'notification_task_nudge_enabled',
      weeklyRecapEnabled: 'notification_weekly_recap_enabled',
      weeklyRecapSendAt: 'notification_weekly_recap_send_at',
      projectMilestoneEnabled: 'notification_project_milestone_enabled',
      leadConversionEnabled: 'notification_lead_conversion_enabled',
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
      setAutoSaveStates(prev => ({ ...prev, [field]: 'idle' }));
      
      toast({
        title: "Updated",
        description: "Notification setting saved successfully",
      });
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

  // Test notification function
  const [testingNotification, setTestingNotification] = useState<string | null>(null);
  
  const testNotification = async (type: string) => {
    setTestingNotification(type);
    try {
      const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
        body: { 
          type,
          isTest: true // Add test flag
        }
      });

      if (error) throw error;

      toast({
        title: "Test Email Sent",
        description: `${type} notification test email has been sent!`,
      });
    } catch (error) {
      console.error('Error testing notification:', error);
      toast({
        title: "Test Failed",
        description: "Failed to send test notification. Please check your settings.",
        variant: "destructive",
      });
    } finally {
      setTestingNotification(null);
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
              <Switch
                id="overdue-reminder"
                checked={settings.overdueReminderEnabled}
                onCheckedChange={(checked) => handleAutoSave('overdueReminderEnabled', checked)}
                disabled={autoSaveStates.overdueReminderEnabled === 'saving'}
              />
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
                <Switch
                  id="delivery-reminder"
                  checked={settings.deliveryReminderEnabled}
                  onCheckedChange={(checked) => handleAutoSave('deliveryReminderEnabled', checked)}
                  disabled={autoSaveStates.deliveryReminderEnabled === 'saving'}
                />
              </div>
              
              {settings.deliveryReminderEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="delivery-time" className="text-sm">Send at:</Label>
                  <Select
                    value={settings.deliveryReminderSendAt}
                    onValueChange={(value) => handleAutoSave('deliveryReminderSendAt', value)}
                    disabled={autoSaveStates.deliveryReminderSendAt === 'saving'}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Switch
                  id="session-reminder"
                  checked={settings.sessionReminderEnabled}
                  onCheckedChange={(checked) => handleAutoSave('sessionReminderEnabled', checked)}
                  disabled={autoSaveStates.sessionReminderEnabled === 'saving'}
                />
              </div>
              
              {settings.sessionReminderEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="session-time" className="text-sm">Send at:</Label>
                  <Select
                    value={settings.sessionReminderSendAt}
                    onValueChange={(value) => handleAutoSave('sessionReminderSendAt', value)}
                    disabled={autoSaveStates.sessionReminderSendAt === 'saving'}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Switch
                  id="daily-summary"
                  checked={settings.dailySummaryEnabled}
                  onCheckedChange={(checked) => handleAutoSave('dailySummaryEnabled', checked)}
                  disabled={autoSaveStates.dailySummaryEnabled === 'saving'}
                />
              </div>
              
              {settings.dailySummaryEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="summary-time" className="text-sm">Send at:</Label>
                  <Select
                    value={settings.dailySummarySendAt}
                    onValueChange={(value) => handleAutoSave('dailySummarySendAt', value)}
                    disabled={autoSaveStates.dailySummarySendAt === 'saving'}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <Switch
                id="task-nudge"
                checked={settings.taskNudgeEnabled}
                onCheckedChange={(checked) => handleAutoSave('taskNudgeEnabled', checked)}
                disabled={autoSaveStates.taskNudgeEnabled === 'saving'}
              />
            </div>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Business Insights"
          description="Weekly reports and business milestone notifications"
          sectionId="business-insights"
        >
          <div className="space-y-6">
            {/* Weekly Recap - Auto-save group */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="weekly-recap" className="text-base font-medium">
                    Weekly Business Recap
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Weekly summary of leads, projects, sessions, and revenue
                  </p>
                </div>
                <Switch
                  id="weekly-recap"
                  checked={settings.weeklyRecapEnabled}
                  onCheckedChange={(checked) => handleAutoSave('weeklyRecapEnabled', checked)}
                  disabled={autoSaveStates.weeklyRecapEnabled === 'saving'}
                />
              </div>
              
              {settings.weeklyRecapEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Label htmlFor="weekly-recap-time" className="text-sm">Send at:</Label>
                  <Select
                    value={settings.weeklyRecapSendAt}
                    onValueChange={(value) => handleAutoSave('weeklyRecapSendAt', value)}
                    disabled={autoSaveStates.weeklyRecapSendAt === 'saving'}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Project Milestone - Pure toggle (auto-save) */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="project-milestone" className="text-base font-medium">
                  Project Milestone Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Get notified when projects reach important milestones
                </p>
              </div>
              <Switch
                id="project-milestone"
                checked={settings.projectMilestoneEnabled}
                onCheckedChange={(checked) => handleAutoSave('projectMilestoneEnabled', checked)}
                disabled={autoSaveStates.projectMilestoneEnabled === 'saving'}
              />
            </div>

            {/* Lead Conversion - Pure toggle (auto-save) */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="lead-conversion" className="text-base font-medium">
                  Lead Conversion Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Get notified when leads are converted to projects
                </p>
              </div>
              <Switch
                id="lead-conversion"
                checked={settings.leadConversionEnabled}
                onCheckedChange={(checked) => handleAutoSave('leadConversionEnabled', checked)}
                disabled={autoSaveStates.leadConversionEnabled === 'saving'}
              />
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
              <Switch
                id="integration-failure"
                checked={settings.integrationFailureAlertEnabled}
                onCheckedChange={(checked) => handleAutoSave('integrationFailureAlertEnabled', checked)}
                disabled={autoSaveStates.integrationFailureAlertEnabled === 'saving'}
              />
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
              <Switch
                id="team-invite-accepted"
                checked={settings.teamInviteAcceptedAlertEnabled}
                onCheckedChange={(checked) => handleAutoSave('teamInviteAcceptedAlertEnabled', checked)}
                disabled={autoSaveStates.teamInviteAcceptedAlertEnabled === 'saving'}
              />
            </div>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Test Notifications"
          description="Send test emails to verify your notification setup is working"
          sectionId="test-notifications"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={() => testNotification('overdue')}
                disabled={testingNotification === 'overdue'}
                className="justify-start"
              >
                {testingNotification === 'overdue' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Overdue Reminder
              </Button>

              <Button
                variant="outline"
                onClick={() => testNotification('delivery')}
                disabled={testingNotification === 'delivery'}
                className="justify-start"
              >
                {testingNotification === 'delivery' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Delivery Reminder
              </Button>

              <Button
                variant="outline"
                onClick={() => testNotification('session')}
                disabled={testingNotification === 'session'}
                className="justify-start"
              >
                {testingNotification === 'session' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Session Reminder
              </Button>

              <Button
                variant="outline"
                onClick={() => testNotification('daily_summary')}
                disabled={testingNotification === 'daily_summary'}
                className="justify-start"
              >
                {testingNotification === 'daily_summary' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Daily Summary
              </Button>

              <Button
                variant="outline"
                onClick={() => testNotification('task_nudge')}
                disabled={testingNotification === 'task_nudge'}
                className="justify-start"
              >
                {testingNotification === 'task_nudge' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Task Nudge
              </Button>

              <Button
                variant="outline"
                onClick={() => testNotification('weekly_recap')}
                disabled={testingNotification === 'weekly_recap'}
                className="justify-start"
              >
                {testingNotification === 'weekly_recap' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Weekly Recap
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p><strong>Note:</strong> Test buttons work regardless of notification settings and send emails based on your current data (leads, sessions, todos, etc.). This helps you verify the email content before enabling notifications.</p>
            </div>
          </div>
        </CategorySettingsSection>
      </div>

    </SettingsPageWrapper>
  );
}