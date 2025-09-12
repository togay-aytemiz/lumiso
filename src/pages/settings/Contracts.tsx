import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { ProtectedFeature } from "@/components/ProtectedFeature";

export default function Contracts() {
  return (
    <ProtectedFeature
      requiredPermissions={['manage_contracts', 'admin']}
      title="Contracts Access Required"
      description="You need contract management or admin permissions to access this section."
    >
      <SettingsPageWrapper>
        <SettingsHeader
          title="Contracts"
          description="Manage contract templates and legal documents"
          helpContent={settingsHelpContent.contracts}
        />
        <p className="text-muted-foreground">Coming soon...</p>
      </SettingsPageWrapper>
    </ProtectedFeature>
  );
}