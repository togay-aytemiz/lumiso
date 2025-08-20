import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import LeadStatusesSection from "@/components/LeadStatusesSection";
import { usePermissions } from "@/hooks/usePermissions";

export default function Leads() {
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
  
  if (!hasPermission('view_lead_statuses')) {
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
        title="Lead Management"
        description="Configure lead statuses and management settings"
      />
      
      <div className="space-y-8">
        <LeadStatusesSection />
      </div>
    </SettingsPageWrapper>
  );
}