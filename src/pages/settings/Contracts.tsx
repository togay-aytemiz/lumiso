import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";

export default function Contracts() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Contracts"
        description="Manage contract templates and legal documents"
        helpContent={settingsHelpContent.contracts}
      />
      <p className="text-muted-foreground">Coming soon...</p>
    </SettingsPageWrapper>
  );
}