import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";

export default function Billing() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Billing & Payments"
        description="Manage your subscription, payment methods, and billing information"
      />
      <p className="text-muted-foreground">Coming soon...</p>
    </SettingsPageWrapper>
  );
}