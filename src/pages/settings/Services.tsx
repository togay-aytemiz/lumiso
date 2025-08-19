import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";
import { usePermissions } from "@/hooks/usePermissions";

export default function Services() {
  const { hasPermission } = usePermissions();
  
  // Show page if user has permission to view packages or services
  const canViewServices = hasPermission('view_services');
  const canViewPackages = hasPermission('view_packages');
  
  if (!canViewServices && !canViewPackages) {
    return (
      <SettingsPageWrapper>
        <div className="text-center py-8">
          <p className="text-muted-foreground">You don't have permission to view this section.</p>
        </div>
      </SettingsPageWrapper>
    );
  }
  
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