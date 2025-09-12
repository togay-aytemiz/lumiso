import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { ProtectedFeature } from "@/components/ProtectedFeature";

export default function Billing() {
  return (
    <ProtectedFeature
      requiredPermissions={['manage_billing', 'admin']}
      title="Billing Access Required"
      description="You need billing management or admin permissions to access this section."
    >
      <SettingsPageWrapper>
        <SettingsHeader
          title="Billing & Payments"
          description="Manage your subscription, payment methods, and billing information"
          helpContent={settingsHelpContent.billing}
        />
        <p className="text-muted-foreground">Coming soon...</p>
      </SettingsPageWrapper>
    </ProtectedFeature>
  );
}