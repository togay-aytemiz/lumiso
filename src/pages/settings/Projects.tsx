import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import ProjectStatusesSection from "@/components/ProjectStatusesSection";
import ProjectTypesSection from "@/components/ProjectTypesSection";
import SessionStatusesSection from "@/components/SessionStatusesSection";
import { usePermissions } from "@/hooks/usePermissions";

export default function Projects() {
  const { hasPermission } = usePermissions();
  
  // Show page if user has permission to view any project/session settings
  const canViewProjectStatuses = hasPermission('view_project_statuses');
  const canViewProjectTypes = hasPermission('view_project_types');
  const canViewSessionStatuses = hasPermission('view_session_statuses');
  
  if (!canViewProjectStatuses && !canViewProjectTypes && !canViewSessionStatuses) {
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
      />
      
      <div className="space-y-8">
        <ProjectStatusesSection />
        <ProjectTypesSection />
        <SessionStatusesSection />
      </div>
    </SettingsPageWrapper>
  );
}