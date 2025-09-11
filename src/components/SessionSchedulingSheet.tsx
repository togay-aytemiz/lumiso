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
import { Calendar, Clock, MapPin, User, Briefcase } from "lucide-react";

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

          {/* Session Summary */}
          {(formData.session_name || formData.session_date || formData.session_time) && (
            <div className="space-y-3 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium text-primary">Session Summary</Label>
              </div>
              
              <div className="space-y-2 text-sm">
                {formData.session_name && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium">{formData.session_name}</span>
                  </div>
                )}
                
                {(formData.session_date || formData.session_time) && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span>
                      {formData.session_date && formData.session_time ? (
                        (() => {
                          const date = new Date(formData.session_date);
                          const [hours, minutes] = formData.session_time.split(':');
                          date.setHours(parseInt(hours), parseInt(minutes));
                          return new Intl.DateTimeFormat(navigator.language, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          }).format(date);
                        })()
                      ) : formData.session_date ? (
                        new Intl.DateTimeFormat(navigator.language, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }).format(new Date(formData.session_date))
                      ) : formData.session_time ? (
                        (() => {
                          const [hours, minutes] = formData.session_time.split(':');
                          const date = new Date();
                          date.setHours(parseInt(hours), parseInt(minutes));
                          return new Intl.DateTimeFormat(navigator.language, {
                            hour: 'numeric',
                            minute: '2-digit'
                          }).format(date);
                        })()
                      ) : null}
                    </span>
                  </div>
                )}
                
                {formData.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span>{formData.location}</span>
                  </div>
                )}
                
                {(projectName || projects.find(p => p.id === formData.project_id)?.name) && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Project: {projectName || projects.find(p => p.id === formData.project_id)?.name}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Client: {leadName}</span>
                </div>
              </div>
            </div>
          )}
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