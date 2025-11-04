import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import LeadStatusesSection from "@/components/LeadStatusesSection";
import { LeadFieldsSection } from "@/components/LeadFieldsSection";
import { useTranslation } from "react-i18next";
// Permissions removed for single photographer mode

export default function Leads() {
  const { t } = useTranslation("pages");
  // Permissions removed for single photographer mode - always allow
  // const { hasPermission, loading } = usePermissions();
  
  // if (loading) {
  //   return (
  //     <SettingsPageWrapper>
  //       <SettingsLoadingSkeleton rows={2} />
  //     </SettingsPageWrapper>
  //   );
  // }
  
  // Always show leads section in single photographer mode
  // if (!hasPermission('view_lead_statuses')) {
  //   return (
  //     <SettingsPageWrapper>
  //       <div className="text-center py-8">
  //         <p className="text-muted-foreground">You don't have permission to view this section.</p>
  //       </div>
  //     </SettingsPageWrapper>
  //   );
  // }
  
  return (
    <SettingsPageWrapper>
      <div className="space-y-8">
        <LeadStatusesSection />
        <LeadFieldsSection />
      </div>
    </SettingsPageWrapper>
  );
}
