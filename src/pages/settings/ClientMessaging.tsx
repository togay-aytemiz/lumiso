import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";

export default function ClientMessaging() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Client Messaging"
        description="Manage message templates and delivery triggers for client-facing communication."
      />
      
      <div className="text-muted-foreground">
        Coming soon...
      </div>
    </SettingsPageWrapper>
  );
}