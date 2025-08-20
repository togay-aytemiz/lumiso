import { useState, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TestTube, Power, PowerOff, Clock, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NotificationSettings {
  // Global settings
  allNotificationsEnabled: boolean;
  globalNotificationTime: string;
  
  // Reminders & Deadlines (scheduled)
  overdueReminderEnabled: boolean;
  deliveryReminderEnabled: boolean;
  sessionReminderEnabled: boolean;
  
  // Tasks & Todos (scheduled)
  dailySummaryEnabled: boolean;
  taskNudgeEnabled: boolean;
  
  // Business Insights (scheduled)
  weeklyRecapEnabled: boolean;
  
  // System Alerts (immediate)
  projectMilestoneEnabled: boolean;
  leadConversionEnabled: boolean;
  integrationFailureAlertEnabled: boolean;
  teamInviteAcceptedAlertEnabled: boolean;
}

export default function Notifications() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    allNotificationsEnabled: true,
    globalNotificationTime: "09:00",
    overdueReminderEnabled: true,
    deliveryReminderEnabled: true,
    sessionReminderEnabled: true,
    dailySummaryEnabled: true,
    taskNudgeEnabled: true,
    weeklyRecapEnabled: true,
    projectMilestoneEnabled: true,
    leadConversionEnabled: true,
    integrationFailureAlertEnabled: true,
    teamInviteAcceptedAlertEnabled: true,
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
        const hasAnyEnabled = data.notification_overdue_reminder_enabled || 
                            data.notification_delivery_reminder_enabled || 
                            data.notification_session_reminder_enabled ||
                            data.notification_daily_summary_enabled ||
                            data.notification_task_nudge_enabled ||
                            data.notification_weekly_recap_enabled ||
                            data.notification_project_milestone_enabled ||
                            data.notification_lead_conversion_enabled ||
                            data.notification_integration_failure_alert_enabled ||
                            data.notification_team_invite_accepted_alert_enabled;
        
        const loadedSettings: NotificationSettings = {
          allNotificationsEnabled: hasAnyEnabled,
          globalNotificationTime: data.notification_daily_summary_send_at ?? "09:00",
          overdueReminderEnabled: data.notification_overdue_reminder_enabled ?? false,
          deliveryReminderEnabled: data.notification_delivery_reminder_enabled ?? false,
          sessionReminderEnabled: data.notification_session_reminder_enabled ?? false,
          dailySummaryEnabled: data.notification_daily_summary_enabled ?? false,
          taskNudgeEnabled: data.notification_task_nudge_enabled ?? false,
          weeklyRecapEnabled: data.notification_weekly_recap_enabled ?? false,
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

  // Master toggle for all notifications
  const handleToggleAllNotifications = async (enabled: boolean) => {
    setAutoSaveStates(prev => ({ ...prev, allNotificationsEnabled: 'saving' }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Update all notification settings at once
      const updates = {
        notification_overdue_reminder_enabled: enabled,
        notification_delivery_reminder_enabled: enabled,
        notification_session_reminder_enabled: enabled,
        notification_daily_summary_enabled: enabled,
        notification_task_nudge_enabled: enabled,
        notification_weekly_recap_enabled: enabled,
        notification_project_milestone_enabled: enabled,
        notification_lead_conversion_enabled: enabled,
        notification_integration_failure_alert_enabled: enabled,
        notification_team_invite_accepted_alert_enabled: enabled,
      };

      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        allNotificationsEnabled: enabled,
        overdueReminderEnabled: enabled,
        deliveryReminderEnabled: enabled,
        sessionReminderEnabled: enabled,
        dailySummaryEnabled: enabled,
        taskNudgeEnabled: enabled,
        weeklyRecapEnabled: enabled,
        projectMilestoneEnabled: enabled,
        leadConversionEnabled: enabled,
        integrationFailureAlertEnabled: enabled,
        teamInviteAcceptedAlertEnabled: enabled,
      }));
      
      setAutoSaveStates(prev => ({ ...prev, allNotificationsEnabled: 'idle' }));
      
      toast({
        title: enabled ? "All Notifications Enabled" : "All Notifications Disabled",
        description: `All notification types have been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling all notifications:', error);
      setAutoSaveStates(prev => ({ ...prev, allNotificationsEnabled: 'idle' }));
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
    }
  };

  // Auto-save function for individual settings
  const handleAutoSave = async (field: keyof NotificationSettings, value: boolean | string) => {
    setAutoSaveStates(prev => ({ ...prev, [field]: 'saving' }));
    
    const fieldMap: {[key in keyof NotificationSettings]: string} = {
      allNotificationsEnabled: 'notification_overdue_reminder_enabled', // dummy, handled separately
      globalNotificationTime: 'notification_daily_summary_send_at',
      overdueReminderEnabled: 'notification_overdue_reminder_enabled',
      deliveryReminderEnabled: 'notification_delivery_reminder_enabled',
      sessionReminderEnabled: 'notification_session_reminder_enabled',
      dailySummaryEnabled: 'notification_daily_summary_enabled',
      taskNudgeEnabled: 'notification_task_nudge_enabled',
      weeklyRecapEnabled: 'notification_weekly_recap_enabled',
      projectMilestoneEnabled: 'notification_project_milestone_enabled',
      leadConversionEnabled: 'notification_lead_conversion_enabled',
      integrationFailureAlertEnabled: 'notification_integration_failure_alert_enabled',
      teamInviteAcceptedAlertEnabled: 'notification_team_invite_accepted_alert_enabled',
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Handle global time setting - update all time-related fields
      if (field === 'globalNotificationTime') {
        const timeUpdates = {
          notification_delivery_reminder_send_at: value as string,
          notification_session_reminder_send_at: value as string,
          notification_daily_summary_send_at: value as string,
          notification_weekly_recap_send_at: value as string,
        };
        
        const { error } = await supabase
          .from('user_settings')
          .update(timeUpdates)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const dbField = fieldMap[field];
        if (!dbField) throw new Error('Invalid field');

        const { error } = await supabase
          .from('user_settings')
          .update({ [dbField]: value })
          .eq('user_id', user.id);

        if (error) throw error;
      }

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
        {/* Master Controls */}
        <CategorySettingsSection
          title="Master Controls"
          description="Global notification settings and timing"
          sectionId="master-controls"
        >
          <div className="space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
              <div className="flex-1">
                <Label htmlFor="all-notifications" className="text-base font-medium flex items-center gap-2">
                  {settings.allNotificationsEnabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                  All Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Master switch to enable or disable all notification types
                </p>
              </div>
              <Switch
                id="all-notifications"
                checked={settings.allNotificationsEnabled}
                onCheckedChange={handleToggleAllNotifications}
                disabled={autoSaveStates.allNotificationsEnabled === 'saving'}
              />
            </div>

            {/* Global Time Setting */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="global-time" className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled Notification Time
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  The time when scheduled notifications (reminders, summaries) will be sent
                </p>
              </div>
              <Select
                value={settings.globalNotificationTime}
                onValueChange={(value) => handleAutoSave('globalNotificationTime', value)}
                disabled={autoSaveStates.globalNotificationTime === 'saving'}
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
          </div>
        </CategorySettingsSection>

        {/* Scheduled Notifications */}
        <CategorySettingsSection
          title="Scheduled Notifications"
          description={`Automated reminders sent daily at ${settings.globalNotificationTime}`}
          sectionId="scheduled"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Clock className="h-4 w-4" />
              <span>These notifications are sent at your scheduled time ({settings.globalNotificationTime})</span>
            </div>

            {/* Overdue Reminder */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="overdue-reminder" className="text-base font-medium">
                  Overdue Reminder
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Daily reminder when tasks or deadlines become overdue
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('overdue')}
                  disabled={testingNotification === 'overdue'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'overdue' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="overdue-reminder"
                  checked={settings.overdueReminderEnabled}
                  onCheckedChange={(checked) => handleAutoSave('overdueReminderEnabled', checked)}
                  disabled={autoSaveStates.overdueReminderEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Delivery Reminder */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="delivery-reminder" className="text-base font-medium">
                  Delivery Reminder
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Daily reminder to check on delivery status
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('delivery')}
                  disabled={testingNotification === 'delivery'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'delivery' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="delivery-reminder"
                  checked={settings.deliveryReminderEnabled}
                  onCheckedChange={(checked) => handleAutoSave('deliveryReminderEnabled', checked)}
                  disabled={autoSaveStates.deliveryReminderEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Session Reminder */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="session-reminder" className="text-base font-medium">
                  Session Reminder
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Daily reminder about upcoming sessions
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('session')}
                  disabled={testingNotification === 'session'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'session' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="session-reminder"
                  checked={settings.sessionReminderEnabled}
                  onCheckedChange={(checked) => handleAutoSave('sessionReminderEnabled', checked)}
                  disabled={autoSaveStates.sessionReminderEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Daily Summary */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="daily-summary" className="text-base font-medium">
                  Daily Summary
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Morning digest of your schedule and pending tasks
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('daily_summary')}
                  disabled={testingNotification === 'daily_summary'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'daily_summary' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="daily-summary"
                  checked={settings.dailySummaryEnabled}
                  onCheckedChange={(checked) => handleAutoSave('dailySummaryEnabled', checked)}
                  disabled={autoSaveStates.dailySummaryEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Task Nudge */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="task-nudge" className="text-base font-medium">
                  Task Nudge
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Gentle reminders to complete pending tasks
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('task_nudge')}
                  disabled={testingNotification === 'task_nudge'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'task_nudge' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="task-nudge"
                  checked={settings.taskNudgeEnabled}
                  onCheckedChange={(checked) => handleAutoSave('taskNudgeEnabled', checked)}
                  disabled={autoSaveStates.taskNudgeEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Weekly Recap */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="weekly-recap" className="text-base font-medium">
                  Weekly Business Recap
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Weekly summary of leads, projects, sessions, and revenue
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('weekly_recap')}
                  disabled={testingNotification === 'weekly_recap'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'weekly_recap' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="weekly-recap"
                  checked={settings.weeklyRecapEnabled}
                  onCheckedChange={(checked) => handleAutoSave('weeklyRecapEnabled', checked)}
                  disabled={autoSaveStates.weeklyRecapEnabled === 'saving'}
                />
              </div>
            </div>
          </div>
        </CategorySettingsSection>

        {/* Immediate Notifications */}
        <CategorySettingsSection
          title="Immediate Notifications"
          description="Real-time alerts sent when events occur"
          sectionId="immediate"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Zap className="h-4 w-4" />
              <span>These notifications are sent immediately when the event happens</span>
            </div>

            {/* Project Milestone */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="project-milestone" className="text-base font-medium">
                  Project Milestone
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Immediate alerts when projects reach important milestones
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('project_milestone')}
                  disabled={testingNotification === 'project_milestone'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'project_milestone' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="project-milestone"
                  checked={settings.projectMilestoneEnabled}
                  onCheckedChange={(checked) => handleAutoSave('projectMilestoneEnabled', checked)}
                  disabled={autoSaveStates.projectMilestoneEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Lead Conversion */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="lead-conversion" className="text-base font-medium">
                  Lead Conversion
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Immediate alerts when leads are converted to projects
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('lead_conversion')}
                  disabled={testingNotification === 'lead_conversion'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'lead_conversion' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="lead-conversion"
                  checked={settings.leadConversionEnabled}
                  onCheckedChange={(checked) => handleAutoSave('leadConversionEnabled', checked)}
                  disabled={autoSaveStates.leadConversionEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Integration Failure Alert */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="integration-failure" className="text-base font-medium">
                  Integration Failure Alert
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Immediate alerts when integrations fail or experience issues
                </p>
              </div>
              <Switch
                id="integration-failure"
                checked={settings.integrationFailureAlertEnabled}
                onCheckedChange={(checked) => handleAutoSave('integrationFailureAlertEnabled', checked)}
                disabled={autoSaveStates.integrationFailureAlertEnabled === 'saving'}
              />
            </div>

            {/* Team Invite Accepted Alert */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="team-invite-accepted" className="text-base font-medium">
                  Team Invite Accepted
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Immediate alerts when team members accept invitations
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
      </div>

    </SettingsPageWrapper>
  );
}