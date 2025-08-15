import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import LeadStatusesSection from "@/components/LeadStatusesSection";

export default function Leads() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Lead Management"
        description="Configure lead statuses and management settings"
      />
      
      <div className="space-y-8">
        <LeadStatusesSection />
      </div>
    </SettingsPageWrapper>
  );
}