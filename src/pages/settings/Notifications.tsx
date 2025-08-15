import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";

export default function Notifications() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Notifications"
        description="Configure how you receive notifications and alerts"
      />
      <p className="text-muted-foreground">Coming soon...</p>
    </SettingsPageWrapper>
  );
}