import { useState, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, TestTube, Power, PowerOff, Clock, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";


interface NotificationSettings {
  // Master Controls
  globalEnabled: boolean;
  scheduledTime: string;
  
  // Scheduled Notifications  
  dailySummaryEnabled: boolean;
  
  // Immediate Notifications
  projectMilestoneEnabled: boolean;
}

export default function Notifications() {
  const { toast } = useToast();
  const { t } = useTranslation('pages');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    globalEnabled: true,
    scheduledTime: "09:00",
    dailySummaryEnabled: true,
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
        projectMilestoneEnabled: enabled,
      }));
      
      setAutoSaveStates(prev => ({ ...prev, globalEnabled: 'idle' }));
      
      toast({
        title: enabled ? t('settings.notifications.toasts.allEnabled') : t('settings.notifications.toasts.allDisabled'),
        description: `${t('settings.notifications.toasts.' + (enabled ? 'allEnabledDesc' : 'allDisabledDesc'))}`,
      });
    } catch (error) {
      console.error('Error toggling all notifications:', error);
      setAutoSaveStates(prev => ({ ...prev, globalEnabled: 'idle' }));
      toast({
        title: t('settings.notifications.toasts.error'),
        description: t('settings.notifications.toasts.errorDesc'),
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
        title: t('settings.notifications.toasts.updated'),
        description: t('settings.notifications.toasts.updatedDesc'),
      });
    } catch (error) {
      console.error('Error saving setting:', error);
      setAutoSaveStates(prev => ({ ...prev, [field]: 'idle' }));
      toast({
        title: t('settings.notifications.toasts.error'),
        description: t('settings.notifications.toasts.errorDesc'),
        variant: "destructive",
      });
    }
  };

  // Test notification function
  const [testingNotification, setTestingNotification] = useState<string | null>(null);
  
  const testNotification = async (type: string) => {
    setTestingNotification(type);
    try {
      let requestBody: any = { 
        type,
        isTest: true 
      };


      const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
        body: requestBody
      });

      if (error) throw error;
      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      toast({
        title: t('settings.notifications.toasts.testSent'),
        description: `${type} ${t('settings.notifications.toasts.testSentDesc')}`,
      });
    } catch (error) {
      console.error('Error testing notification:', error);
      toast({
        title: t('settings.notifications.toasts.testFailed'),
        description: error instanceof Error
          ? error.message
          : t('settings.notifications.toasts.testFailedDesc'),
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
        <SettingsLoadingSkeleton rows={4} />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <div className="space-y-8">
        {/* Master Controls */}
        <CategorySettingsSection
          title={t('settings.notifications.masterControls.title')}
          description={t('settings.notifications.masterControls.description')}
          sectionId="master-controls"
        >
          <div className="space-y-6">
            {/* Master Toggle */}
            <div className="flex flex-col gap-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <Label htmlFor="global-notifications" className="text-base font-medium flex items-center gap-2">
                  {settings.globalEnabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                  {t('settings.notifications.masterControls.allNotifications')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.notifications.masterControls.allNotificationsHelp')}
                </p>
              </div>
              <Switch
                id="global-notifications"
                checked={settings.globalEnabled}
                onCheckedChange={handleToggleAllNotifications}
                disabled={autoSaveStates.globalEnabled === 'saving'}
                className="self-end sm:self-auto"
              />
            </div>

            {/* Scheduled Time Setting */}
            <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <Label htmlFor="scheduled-time" className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('settings.notifications.masterControls.scheduledTime')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.notifications.masterControls.scheduledTimeHelp')}
                </p>
              </div>
              <Select
                value={settings.scheduledTime}
                onValueChange={(value) => handleAutoSave('scheduledTime', value)}
                disabled={autoSaveStates.scheduledTime === 'saving'}
              >
                <SelectTrigger className="w-full sm:w-32">
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
          title={t('settings.notifications.scheduled.title')}
          description={`${t('settings.notifications.scheduled.description')} ${settings.scheduledTime}`}
          sectionId="scheduled"
        >
          <div className="space-y-6">

            {/* Daily Summary */}
            <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <Label htmlFor="daily-summary" className="text-base font-medium">
                  {t('settings.notifications.scheduled.dailySummary')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.notifications.scheduled.dailySummaryHelp')}
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testNotification('daily-summary-empty')}
                  disabled={testingNotification === 'daily-summary-empty'}
                  className="text-muted-foreground hover:text-muted-foreground/80 hover:bg-transparent p-0 h-auto font-medium text-sm"
                >
                  {testingNotification === 'daily-summary-empty' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {t('settings.notifications.testing')}
                    </>
                  ) : (
                    t('settings.notifications.sendEmptyTest')
                  )}
                </Button>
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
                      {t('settings.notifications.testing')}
                    </>
                  ) : (
                    t('settings.notifications.sendTest')
                  )}
                </Button>
                <Switch
                  id="daily-summary"
                  checked={settings.dailySummaryEnabled}
                  onCheckedChange={(checked) => handleAutoSave('dailySummaryEnabled', checked)}
                  disabled={autoSaveStates.dailySummaryEnabled === 'saving'}
                  className="self-end sm:self-auto"
                />
              </div>
            </div>

          </div>
        </CategorySettingsSection>

        {/* Immediate Notifications */}
        <CategorySettingsSection
          title={t('settings.notifications.immediate.title')}
          description={t('settings.notifications.immediate.description')}
          sectionId="immediate"
        >
          <div className="space-y-6">


            {/* Project Milestone */}
            <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <Label htmlFor="project-milestone" className="text-base font-medium">
                  {t('settings.notifications.immediate.projectMilestone')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.notifications.immediate.projectMilestoneHelp')}
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
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
                      {t('settings.notifications.testing')}
                    </>
                  ) : (
                    t('settings.notifications.sendTest')
                  )}
                </Button>
                <Switch
                  id="project-milestone"
                  checked={settings.projectMilestoneEnabled}
                  onCheckedChange={(checked) => handleAutoSave('projectMilestoneEnabled', checked)}
                  disabled={autoSaveStates.projectMilestoneEnabled === 'saving'}
                  className="self-end sm:self-auto"
                />
              </div>
            </div>
          </div>
        </CategorySettingsSection>

      </div>
    </SettingsPageWrapper>
  );
}
