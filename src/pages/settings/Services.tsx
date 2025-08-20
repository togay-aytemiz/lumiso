import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";
import { usePermissions } from "@/hooks/usePermissions";

export default function Services() {
  const { hasPermission, loading } = usePermissions();
  
  if (loading) {
    return (
      <SettingsPageWrapper>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SettingsPageWrapper>
    );
  }
  
  // Show page if user has permission to view packages or services
  const canViewServices = hasPermission('view_services');
  const canViewPackages = hasPermission('view_packages');
  
  const hasAnyPermission = canViewServices || canViewPackages;
  
  if (!hasAnyPermission) {
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
        {canViewPackages && <PackagesSection />}
        {canViewServices && <ServicesSection />}
      </div>
    </SettingsPageWrapper>
  );
}