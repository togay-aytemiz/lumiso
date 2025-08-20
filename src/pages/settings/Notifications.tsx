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
  // Master Controls
  globalEnabled: boolean;
  scheduledTime: string;
  
  // Scheduled Notifications  
  dailySummaryEnabled: boolean;
  weeklyRecapEnabled: boolean;
  
  // Immediate Notifications
  newAssignmentEnabled: boolean;
  projectMilestoneEnabled: boolean;
}

export default function Notifications() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    globalEnabled: true,
    scheduledTime: "09:00",
    dailySummaryEnabled: true,
    weeklyRecapEnabled: true,
    newAssignmentEnabled: true,
    projectMilestoneEnabled: true,
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
          globalEnabled: data.notification_global_enabled ?? true,
          scheduledTime: data.notification_scheduled_time ?? "09:00",
          dailySummaryEnabled: data.notification_daily_summary_enabled ?? true,
          weeklyRecapEnabled: data.notification_weekly_recap_enabled ?? true,
          newAssignmentEnabled: data.notification_new_assignment_enabled ?? true,
          projectMilestoneEnabled: data.notification_project_milestone_enabled ?? true,
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
    setAutoSaveStates(prev => ({ ...prev, globalEnabled: 'saving' }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Update global setting and all individual settings
      const updates = {
        notification_global_enabled: enabled,
        notification_daily_summary_enabled: enabled,
        notification_weekly_recap_enabled: enabled,
        notification_new_assignment_enabled: enabled,
        notification_project_milestone_enabled: enabled,
      };

      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        globalEnabled: enabled,
        dailySummaryEnabled: enabled,
        weeklyRecapEnabled: enabled,
        newAssignmentEnabled: enabled,
        projectMilestoneEnabled: enabled,
      }));
      
      setAutoSaveStates(prev => ({ ...prev, globalEnabled: 'idle' }));
      
      toast({
        title: enabled ? "All Notifications Enabled" : "All Notifications Disabled",
        description: `All notification types have been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling all notifications:', error);
      setAutoSaveStates(prev => ({ ...prev, globalEnabled: 'idle' }));
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
      globalEnabled: 'notification_global_enabled',
      scheduledTime: 'notification_scheduled_time',
      dailySummaryEnabled: 'notification_daily_summary_enabled',
      weeklyRecapEnabled: 'notification_weekly_recap_enabled',
      newAssignmentEnabled: 'notification_new_assignment_enabled',
      projectMilestoneEnabled: 'notification_project_milestone_enabled',
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
        description="Streamlined notification system with 3 core types for your photography business"
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
                <Label htmlFor="global-notifications" className="text-base font-medium flex items-center gap-2">
                  {settings.globalEnabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                  All Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Master switch to enable or disable all notification types
                </p>
              </div>
              <Switch
                id="global-notifications"
                checked={settings.globalEnabled}
                onCheckedChange={handleToggleAllNotifications}
                disabled={autoSaveStates.globalEnabled === 'saving'}
              />
            </div>

            {/* Scheduled Time Setting */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="scheduled-time" className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled Notification Time
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Time when daily summaries and weekly recaps are sent
                </p>
              </div>
              <Select
                value={settings.scheduledTime}
                onValueChange={(value) => handleAutoSave('scheduledTime', value)}
                disabled={autoSaveStates.scheduledTime === 'saving'}
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
          description={`Automated summaries sent at ${settings.scheduledTime}`}
          sectionId="scheduled"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Clock className="h-4 w-4" />
              <span>These notifications are sent at your scheduled time ({settings.scheduledTime})</span>
            </div>

            {/* Daily Summary */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="daily-summary" className="text-base font-medium">
                  Daily Summary
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Morning digest with today's sessions, overdue items, reminders, and pending tasks
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('daily-summary')}
                  disabled={testingNotification === 'daily-summary'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'daily-summary' ? (
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

            {/* Weekly Recap */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="weekly-recap" className="text-base font-medium">
                  Weekly Recap (Owner Only)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Weekly business insights: leads, projects, sessions, revenue, and aging alerts
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('weekly-recap')}
                  disabled={testingNotification === 'weekly-recap'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'weekly-recap' ? (
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
          description="Real-time alerts sent as events occur"
          sectionId="immediate"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Zap className="h-4 w-4" />
              <span>These notifications are sent immediately when events occur</span>
            </div>

            {/* New Assignment */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="new-assignment" className="text-base font-medium">
                  New Assignment
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Notify when you're assigned to a lead or project (includes entity name and assigner)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('new-assignment')}
                  disabled={testingNotification === 'new-assignment'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'new-assignment' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Email'
                  )}
                </Button>
                <Switch
                  id="new-assignment"
                  checked={settings.newAssignmentEnabled}
                  onCheckedChange={(checked) => handleAutoSave('newAssignmentEnabled', checked)}
                  disabled={autoSaveStates.newAssignmentEnabled === 'saving'}
                />
              </div>
            </div>

            {/* Project Milestone */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="project-milestone" className="text-base font-medium">
                  Project Milestone Reached
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Notify when a project transitions to Completed or Cancelled lifecycle
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('project-milestone')}
                  disabled={testingNotification === 'project-milestone'}
                  className="text-primary hover:text-primary/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'project-milestone' ? (
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
          </div>
        </CategorySettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}