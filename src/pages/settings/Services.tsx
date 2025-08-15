import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";

export default function Services() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Packages & Services"
        description="Create service packages and manage individual services for your business"
      />
      
      <div className="space-y-8">
        <PackagesSection />
        <ServicesSection />
      </div>
    </SettingsPageWrapper>
  );
}