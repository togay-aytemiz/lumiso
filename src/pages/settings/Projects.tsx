import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import ProjectStatusesSection from "@/components/ProjectStatusesSection";
import ProjectTypesSection from "@/components/ProjectTypesSection";
import SessionStatusesSection from "@/components/SessionStatusesSection";
import { usePermissions } from "@/hooks/usePermissions";
import { ProtectedFeature } from "@/components/ProtectedFeature";

export default function Projects() {
  const { hasViewOrManage, loading } = usePermissions();
  
  // Show loading while permissions are being fetched
  if (loading) {
    return (
      <SettingsPageWrapper>
        <SettingsLoadingSkeleton rows={2} />
      </SettingsPageWrapper>
    );
  }
  
  // Show page if user has permission to view any project/session settings
  const canViewProjectStatuses = hasViewOrManage('project_statuses');
  const canViewProjectTypes = hasViewOrManage('project_types');
  const canViewSessionStatuses = hasViewOrManage('session_statuses');
  
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
    <ProtectedFeature
      requiredPermissions={['view_project_statuses', 'manage_project_statuses', 'view_project_types', 'manage_project_types', 'view_session_statuses', 'manage_session_statuses']}
      title="Projects & Sessions Settings Access Required"
      description="You need permission to view or manage project statuses, types, or session statuses to access this section."
    >
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
    </ProtectedFeature>
  );
}