import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { generateSessionName } from "@/lib/sessionUtils";
import { useSessionForm } from "@/hooks/useSessionForm";
import { CalendarTimePicker } from "@/components/CalendarTimePicker";
import { SessionFormFields } from "@/components/SessionFormFields";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  name: string;
}

interface SessionSchedulingSheetProps {
  leadId: string;
  leadName: string;
  projectId?: string;
  projectName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionScheduled?: () => void;
}

export function SessionSchedulingSheet({
  leadId,
  leadName,
  projectId,
  projectName,
  isOpen,
  onOpenChange,
  onSessionScheduled
}: SessionSchedulingSheetProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [projects, setProjects] = useState<Project[]>([]);
  
  const showProjectSelector = !projectId && !projectName;

  const {
    formData,
    loading,
    isDirty,
    isValid,
    handleInputChange,
    resetForm,
    submitForm
  } = useSessionForm({
    leadId,
    leadName,
    projectId,
    onSuccess: () => {
      setSelectedDate(undefined);
      onOpenChange(false);
      onSessionScheduled?.();
    }
  });

  // Auto-populate session name when component mounts or project changes
  useEffect(() => {
    const targetProjectName = projectName || projects.find(p => p.id === formData.project_id)?.name;
    if (targetProjectName && !formData.session_name.trim()) {
      handleInputChange("session_name", generateSessionName(targetProjectName));
    } else if (!targetProjectName && leadName && !formData.session_name.trim()) {
      handleInputChange("session_name", generateSessionName(leadName));
    }
  }, [projectName, formData.project_id, projects, formData.session_name, leadName, handleInputChange]);

  const fetchProjects = async () => {
    if (!showProjectSelector) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('lead_id', leadId)
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      setProjects(projectsData || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      resetForm();
      setSelectedDate(undefined);
      onOpenChange(false);
    },
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      resetForm();
      setSelectedDate(undefined);
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Scheduling..." : "Schedule Session",
      onClick: submitForm,
      disabled: loading || !isValid,
      loading: loading
    }
  ];

  return (
    <>
      <AppSheetModal
        title="Schedule Session"
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="wide"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-6">
          {/* Form Fields */}
          <SessionFormFields
            leadName={leadName}
            projectName={projectName}
            sessionName={formData.session_name}
            location={formData.location}
            notes={formData.notes}
            projectId={formData.project_id}
            showProjectSelector={showProjectSelector}
            availableProjects={projects}
            onSessionNameChange={(value) => handleInputChange("session_name", value)}
            onLocationChange={(value) => handleInputChange("location", value)}
            onNotesChange={(value) => handleInputChange("notes", value)}
            onProjectChange={(value) => handleInputChange("project_id", value)}
          />

          {/* Date & Time Selection */}
          <div className="space-y-4">
            <Label>Schedule Session *</Label>
            <CalendarTimePicker
              selectedDate={selectedDate}
              selectedTime={formData.session_time}
              onDateChange={setSelectedDate}
              onTimeChange={(time) => handleInputChange("session_time", time)}
              onDateStringChange={(dateString) => handleInputChange("session_date", dateString)}
            />
          </div>
        </div>
      </AppSheetModal>

      <NavigationGuardDialog
        open={navigation.showGuard}
        message={navigation.message}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
      />
    </>
  );
}