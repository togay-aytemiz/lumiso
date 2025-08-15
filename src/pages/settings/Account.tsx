import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";

export default function Account() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Account & Users"
        description="Manage your account settings and user permissions"
      />
      <p className="text-muted-foreground">Coming soon...</p>
    </SettingsPageWrapper>
  );
}