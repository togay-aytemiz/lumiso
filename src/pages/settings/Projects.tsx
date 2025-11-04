import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import ProjectStatusesSection from "@/components/ProjectStatusesSection";
import ProjectTypesSection from "@/components/ProjectTypesSection";
import SessionStatusesSection from "@/components/SessionStatusesSection";
import { useTranslation } from "react-i18next";
// Permissions removed for single photographer mode

export default function Projects() {
  const { t } = useTranslation("pages");
  // Permissions removed for single photographer mode - always allow
  // const { hasPermission, loading } = usePermissions();
  
  // Always show projects section in single photographer mode
  // Show loading while permissions are being fetched
  // if (loading) {
  //   return (
  //     <SettingsPageWrapper>
  //       <SettingsLoadingSkeleton rows={2} />
  //     </SettingsPageWrapper>
  //   );
  // }
  
  // Show page if user has permission to view any project/session settings
  // const canViewProjectStatuses = hasPermission('view_project_statuses');
  // const canViewProjectTypes = hasPermission('view_project_types');
  // const canViewSessionStatuses = hasPermission('view_session_statuses');
  
  // const hasAnyPermission = canViewProjectStatuses || canViewProjectTypes || canViewSessionStatuses;
  
  // if (!hasAnyPermission) {
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
        {/* Always show all sections in single photographer mode */}
        <ProjectStatusesSection />
        <ProjectTypesSection />
        <SessionStatusesSection />
      </div>
    </SettingsPageWrapper>
  );
}
