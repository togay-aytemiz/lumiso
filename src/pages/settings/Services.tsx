import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";

export default function Services() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Services & Pricing"
        description="Manage your service offerings and pricing structure"
      />
      
      <div className="space-y-8">
        <PackagesSection />
        <ServicesSection />
      </div>
    </SettingsPageWrapper>
  );
}