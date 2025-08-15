import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";

export default function Contracts() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Contracts"
        description="Manage contract templates and legal documents"
      />
      <p className="text-muted-foreground">Coming soon...</p>
    </SettingsPageWrapper>
  );
}