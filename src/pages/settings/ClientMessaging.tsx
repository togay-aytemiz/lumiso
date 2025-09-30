import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import SettingsSection from "@/components/SettingsSection";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

export default function ClientMessaging() {
  const { t } = useTranslation("pages");
  const [silentHours, setSilentHours] = useState({
    startTime: "22:00",
    endTime: "08:00",
    enabled: true
  });

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

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title={t("settings.clientMessaging.title")}
        description={t("settings.clientMessaging.description")}
        helpContent={settingsHelpContent.clientMessaging}
      />
      
      <div className="space-y-8">
        <SettingsSection
          title={t("settings.clientMessaging.silentHours.title")}
          description={t("settings.clientMessaging.silentHours.description")}
        >
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">{t("settings.clientMessaging.silentHours.enable")}</Label>
                <p className="text-sm text-muted-foreground">
                  {silentHours.enabled 
                    ? t("settings.clientMessaging.silentHours.enabledDesc")
                    : t("settings.clientMessaging.silentHours.disabledDesc")
                  }
                </p>
              </div>
              <Switch
                checked={silentHours.enabled}
                onCheckedChange={(checked) => setSilentHours(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            {/* Time Configuration */}
            <div className={`space-y-4 transition-opacity ${silentHours.enabled ? "opacity-100" : "opacity-50"}`}>
              <Label className="text-base font-medium">{t("settings.clientMessaging.silentHours.timeWindow")}</Label>
              
              {/* Mobile-responsive layout: compact inline layout */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Start Time */}
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="text-sm text-muted-foreground">
                    {t("settings.clientMessaging.silentHours.startTime")}
                  </Label>
                  <Select
                    value={silentHours.startTime}
                    onValueChange={(value) => setSilentHours(prev => ({ ...prev, startTime: value }))}
                    disabled={!silentHours.enabled}
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

                {/* "to" connector */}
                <div className="pt-6">
                  <span className="text-muted-foreground">{t("settings.clientMessaging.silentHours.to")}</span>
                </div>

                {/* End Time */}
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="text-sm text-muted-foreground">
                    {t("settings.clientMessaging.silentHours.endTime")}
                  </Label>
                  <Select
                    value={silentHours.endTime}
                    onValueChange={(value) => setSilentHours(prev => ({ ...prev, endTime: value }))}
                    disabled={!silentHours.enabled}
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

              {/* Helper text */}
              {silentHours.enabled && (
                <p className="text-sm text-muted-foreground">
                  {t("settings.clientMessaging.silentHours.helpText", { 
                    startTime: silentHours.startTime, 
                    endTime: silentHours.endTime 
                  })}
                </p>
              )}
            </div>
          </div>
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}