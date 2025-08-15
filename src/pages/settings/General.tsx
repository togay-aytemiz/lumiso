import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";

export default function General() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="General"
        description="Manage your general application preferences"
      />
      <p className="text-muted-foreground">Coming soon...</p>
    </SettingsPageWrapper>
  );
}