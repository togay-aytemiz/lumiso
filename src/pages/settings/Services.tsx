import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import ServicesSection from "@/components/ServicesSection";

export default function Services() {
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Services & Pricing"
        description="Manage your service offerings and pricing structure"
      />
      
      <div className="space-y-8">
        <ServicesSection />
      </div>
    </SettingsPageWrapper>
  );
}