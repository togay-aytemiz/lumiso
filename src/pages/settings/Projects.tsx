import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import ProjectStatusesSection from "@/components/ProjectStatusesSection";
import ProjectTypesSection from "@/components/ProjectTypesSection";
import SessionStatusesSection from "@/components/SessionStatusesSection";
import { usePermissions } from "@/hooks/usePermissions";

export default function Projects() {
  const { hasPermission, loading } = usePermissions();
  
  // Show loading while permissions are being fetched
  if (loading) {
    return (
      <SettingsPageWrapper>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SettingsPageWrapper>
    );
  }
  
  // Show page if user has permission to view any project/session settings
  const canViewProjectStatuses = hasPermission('view_project_statuses');
  const canViewProjectTypes = hasPermission('view_project_types');
  const canViewSessionStatuses = hasPermission('view_session_statuses');
  
  const hasAnyPermission = canViewProjectStatuses || canViewProjectTypes || canViewSessionStatuses;
  
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
        title="Projects & Sessions"
        description="Manage project stages, types, and session statuses"
        helpContent={settingsHelpContent.projects}
      />
      
      <div className="space-y-8">
        {canViewProjectStatuses && <ProjectStatusesSection />}
        {canViewProjectTypes && <ProjectTypesSection />}
        {canViewSessionStatuses && <SessionStatusesSection />}
      </div>
    </SettingsPageWrapper>
  );
}