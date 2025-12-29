import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsToggleSection } from "@/components/settings/SettingsSectionVariants";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Power, Clock, Zap, Images } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";
import {
  useNotificationSettings,
  NotificationSettings,
} from "@/hooks/useNotificationSettings";
import { useUserRole } from "@/hooks/useUserRole";

export default function Notifications() {
  const { toast } = useToast();
  const { t } = useTranslation('pages');
  const { settings, loading, updateSettings } = useNotificationSettings();
  const { isAdmin } = useUserRole();
  const isAdminUser = isAdmin();
  const [autoSaveStates, setAutoSaveStates] = useState<{[key: string]: 'idle' | 'saving'}>({});
  const notificationTypeLabels: Record<string, string> = {
    'daily-summary': t('settings.notifications.testTypes.dailySummary'),
    'daily-summary-empty': t('settings.notifications.testTypes.dailySummaryEmpty'),
    'project-milestone': t('settings.notifications.testTypes.projectMilestone'),
  };

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

  // Master toggle for all notifications
  const handleToggleAllNotifications = async (enabled: boolean) => {
    setAutoSaveStates(prev => ({ ...prev, globalEnabled: 'saving' }));
    try {
      await updateSettings({
        globalEnabled: enabled,
        dailySummaryEnabled: enabled,
        projectMilestoneEnabled: enabled,
        gallerySelectionEnabled: enabled,
      });
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

    try {
      await updateSettings({ [field]: value });
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
    if (!isAdminUser) return;

    setTestingNotification(type);
    try {
      const requestBody: Record<string, unknown> = {
        type,
        isTest: true,
      };


      const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
        body: requestBody
      });

      if (error) throw error;
      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      const typeLabel = notificationTypeLabels[type] ?? type;
      toast({
        title: t('settings.notifications.toasts.testSent'),
        description: `${typeLabel} ${t('settings.notifications.toasts.testSentDesc')}`,
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

  const masterToggleItems = [
    {
      id: "global-enabled",
      title: t('settings.notifications.masterControls.allNotifications'),
      description: t('settings.notifications.masterControls.allNotificationsHelp'),
      icon: Power,
      control: (
        <Switch
          id="global-notifications"
          checked={settings.globalEnabled}
          onCheckedChange={handleToggleAllNotifications}
          disabled={autoSaveStates.globalEnabled === 'saving'}
          aria-label={t('settings.notifications.masterControls.allNotifications')}
        />
      ),
    },
    {
      id: "scheduled-time",
      title: t('settings.notifications.masterControls.scheduledTime'),
      description: t('settings.notifications.masterControls.scheduledTimeHelp'),
      icon: Clock,
      control: (
        <Select
          value={settings.scheduledTime}
          onValueChange={(value) => handleAutoSave('scheduledTime', value)}
          disabled={autoSaveStates.scheduledTime === 'saving'}
        >
          <SelectTrigger
            className="w-32"
            aria-label={t('settings.notifications.masterControls.scheduledTime')}
          >
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
      ),
    },
  ];

  const scheduledItems = [
    {
      id: "daily-summary",
      title: t('settings.notifications.scheduled.dailySummary'),
      description: `${t('settings.notifications.scheduled.description')} ${settings.scheduledTime}`,
      icon: Clock,
      control: (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
          {isAdminUser && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => testNotification('daily-summary-empty')}
                disabled={testingNotification === 'daily-summary-empty'}
                className="h-auto px-0 text-sm text-muted-foreground hover:text-muted-foreground/80"
              >
                {testingNotification === 'daily-summary-empty' ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
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
                className="h-auto px-0 text-sm text-primary hover:text-primary/80"
              >
                {testingNotification === 'daily-summary' ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('settings.notifications.testing')}
                  </>
                ) : (
                  t('settings.notifications.sendTest')
                )}
              </Button>
            </div>
          )}
          <Switch
            id="daily-summary"
            checked={settings.dailySummaryEnabled}
            onCheckedChange={(checked) => handleAutoSave('dailySummaryEnabled', checked)}
            disabled={autoSaveStates.dailySummaryEnabled === 'saving'}
            aria-label={t('settings.notifications.scheduled.dailySummary')}
          />
        </div>
      ),
    },
  ];

  const immediateItems = [
    {
      id: "project-milestone",
      title: t('settings.notifications.immediate.projectMilestone'),
      description: t('settings.notifications.immediate.projectMilestoneHelp'),
      icon: Zap,
      control: (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
          {isAdminUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => testNotification('project-milestone')}
              disabled={testingNotification === 'project-milestone'}
              className="h-auto px-0 text-sm text-primary hover:text-primary/80"
            >
              {testingNotification === 'project-milestone' ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {t('settings.notifications.testing')}
                </>
              ) : (
                t('settings.notifications.sendTest')
              )}
            </Button>
          )}
          <Switch
            id="project-milestone"
            checked={settings.projectMilestoneEnabled}
            onCheckedChange={(checked) => handleAutoSave('projectMilestoneEnabled', checked)}
            disabled={autoSaveStates.projectMilestoneEnabled === 'saving'}
            aria-label={t('settings.notifications.immediate.projectMilestone')}
          />
        </div>
      ),
    },
    {
      id: "gallery-selection",
      title: t('settings.notifications.immediate.gallerySelection'),
      description: t('settings.notifications.immediate.gallerySelectionHelp'),
      icon: Images,
      control: (
        <Switch
          id="gallery-selection"
          checked={settings.gallerySelectionEnabled}
          onCheckedChange={(checked) => handleAutoSave('gallerySelectionEnabled', checked)}
          disabled={autoSaveStates.gallerySelectionEnabled === 'saving'}
          aria-label={t('settings.notifications.immediate.gallerySelection')}
        />
      ),
    },
  ];

  return (
    <SettingsPageWrapper>
      <div className="space-y-10">
        <SettingsToggleSection
          layout="two-column"
          sectionId="master-controls"
          title={t('settings.notifications.masterControls.title')}
          description={t('settings.notifications.masterControls.description')}
          dataWalkthrough="notifications-master"
          items={masterToggleItems}
        />
        <SettingsToggleSection
          layout="two-column"
          sectionId="scheduled"
          title={t('settings.notifications.scheduled.title')}
          description={`${t('settings.notifications.scheduled.description')} ${settings.scheduledTime}`}
          dataWalkthrough="notifications-scheduled"
          items={scheduledItems}
        />
        <SettingsToggleSection
          layout="two-column"
          sectionId="immediate"
          title={t('settings.notifications.immediate.title')}
          description={t('settings.notifications.immediate.description')}
          dataWalkthrough="notifications-immediate"
          items={immediateItems}
        />
      </div>
      <p className="px-4 pt-6 text-center text-xs text-muted-foreground sm:text-sm">
        {t('settings.notifications.moreComing', {
          defaultValue: 'More notification types are on the way.',
        })}
      </p>
    </SettingsPageWrapper>
  );
}
