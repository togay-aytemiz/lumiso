import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { generateSessionName } from "@/lib/sessionUtils";
import { useSessionEditForm } from "@/hooks/useSessionEditForm";
import { CalendarTimePicker } from "@/components/CalendarTimePicker";
import { SessionFormFields } from "@/components/SessionFormFields";
import { getUserLocale, formatLongDate, formatTime } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, User, Briefcase } from "lucide-react";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
}

interface EditSessionDialogProps {
  sessionId: string;
  leadId: string;
  currentDate: string;
  currentTime: string;
  currentNotes: string;
  currentLocation?: string;
  currentProjectId?: string;
  currentSessionName?: string;
  leadName?: string;
  onSessionUpdated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const EditSessionDialog = ({ 
  sessionId, 
  leadId, 
  currentDate, 
  currentTime, 
  currentNotes, 
  currentLocation, 
  currentProjectId, 
  currentSessionName, 
  leadName, 
  onSessionUpdated, 
  open = false, 
  onOpenChange 
}: EditSessionDialogProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [initError, setInitError] = useState<string | null>(null);

  // Create initial data with error handling
  const initialData = React.useMemo(() => {
    try {
      return {
        session_name: currentSessionName || "",
        session_date: currentDate || "",
        session_time: currentTime || "",
        notes: currentNotes || "",
        location: currentLocation || "",
        project_id: currentProjectId || ""
      };
    } catch (error) {
      console.error('Error creating initial data:', error);
      setInitError('Failed to initialize form data');
      return {
        session_name: "",
        session_date: "",
        session_time: "",
        notes: "",
        location: "",
        project_id: ""
      };
    }
  }, [currentSessionName, currentDate, currentTime, currentNotes, currentLocation, currentProjectId]);

  const {
    formData,
    loading,
    errors,
    isDirty,
    isValid,
    handleInputChange,
    resetForm,
    submitForm
  } = useSessionEditForm({
    sessionId,
    leadId,
    leadName: leadName || "",
    initialData,
    onSuccess: () => {
      onOpenChange?.(false);
      onSessionUpdated?.();
    }
  });

  // Get selected date from form data
  const selectedDate = formData.session_date ? new Date(formData.session_date + 'T00:00:00') : undefined;

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const organizationId = await getUserOrganizationId();
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
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      resetForm();
      onOpenChange?.(false);
    },
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      resetForm();
      onOpenChange?.(false);
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
      label: loading ? "Updating..." : "Update Session",
      onClick: submitForm,
      disabled: loading || !isValid,
      loading: loading
    }
  ];

  return (
    <>
      <AppSheetModal
        title="Edit Session"
        isOpen={open}
        onOpenChange={onOpenChange || (() => {})}
        size="wide"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        {initError ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{initError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => {
                setInitError(null);
                onOpenChange?.(false);
              }}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
          {/* Form Fields */}
          <SessionFormFields
            leadName={leadName || ""}
            sessionName={formData.session_name}
            location={formData.location}
            notes={formData.notes}
            projectId={formData.project_id}
            showProjectSelector={true}
            availableProjects={projects}
            onSessionNameChange={(value) => handleInputChange("session_name", value)}
            onLocationChange={(value) => handleInputChange("location", value)}
            onNotesChange={(value) => handleInputChange("notes", value)}
            onProjectChange={(value) => handleInputChange("project_id", value)}
          />

          {/* Date & Time Selection */}
          <div className="space-y-4">
            <CalendarTimePicker
              selectedDate={selectedDate}
              selectedTime={formData.session_time}
              onDateChange={(date) => {
                if (date) {
                  handleInputChange("session_date", format(date, "yyyy-MM-dd"));
                } else {
                  handleInputChange("session_date", "");
                }
              }}
              onTimeChange={(time) => handleInputChange("session_time", time)}
              onDateStringChange={(dateString) => handleInputChange("session_date", dateString)}
            />
            {errors.session_date && <p className="text-sm text-destructive">{errors.session_date}</p>}
            {errors.session_time && <p className="text-sm text-destructive">{errors.session_time}</p>}
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
                       {formData.session_date ? 
                         formatLongDate(formData.session_date, getUserLocale()) : 'Date not set'
                       }
                       {formData.session_time && formData.session_date ? (
                         <> at {formatTime(formData.session_time, getUserLocale())}</>
                       ) : formData.session_time ? (
                         <> Time: {formatTime(formData.session_time, getUserLocale())}</>
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
                
                {projects.find(p => p.id === formData.project_id)?.name && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Project: {projects.find(p => p.id === formData.project_id)?.name}
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
        )}
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
};

export default EditSessionDialog;