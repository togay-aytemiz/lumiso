import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import SettingsSection from "@/components/SettingsSection";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function ClientMessaging() {
  // Simplified state - only for silent hours now
  const [silentHours, setSilentHours] = useState({
    startTime: "22:00",
    endTime: "08:00",
    enabled: true
  });

  // Helper function for time options
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Silent Hours"
        description="Configure when automated messages should not be sent to clients"
        helpContent={settingsHelpContent.clientMessaging}
      />
      
      <div className="space-y-8">
        {/* Future: Templates will be managed in dedicated Templates page */}
        
        {/* Silent Hours Section */}
        <SettingsSection
          title="Silent Hours"
          description="Messages will not be sent during this time window. Any messages triggered at night will be delayed until the next morning."
        >
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Enable Silent Hours</Label>
                <p className="text-sm text-muted-foreground">
                  {silentHours.enabled 
                    ? "Messages triggered during silent hours will be delayed until the next morning"
                    : "When disabled, messages will be sent immediately regardless of the time of day"
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
              <Label className="text-base font-medium">Time Window</Label>
              
              {/* Mobile-responsive layout: compact inline layout */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Start Time */}
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="text-sm text-muted-foreground">
                    Start Time
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
                  <span className="text-muted-foreground">to</span>
                </div>

                {/* End Time */}
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="text-sm text-muted-foreground">
                    End Time
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
                  Messages triggered between {silentHours.startTime} and {silentHours.endTime} will be sent after silent hours end.
                </p>
              )}
            </div>
          </div>
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}