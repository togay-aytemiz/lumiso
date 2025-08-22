import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";

export default function Billing() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Billing & Payments"
        description="Manage your subscription, payment methods, and billing information"
        helpContent={settingsHelpContent.billing}
      />
      <p className="text-muted-foreground">Coming soon...</p>
    </SettingsPageWrapper>
  );
}