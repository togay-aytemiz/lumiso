import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import ProjectStatusesSection from "@/components/ProjectStatusesSection";
import ProjectTypesSection from "@/components/ProjectTypesSection";
import SessionStatusesSection from "@/components/SessionStatusesSection";

export default function Projects() {
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