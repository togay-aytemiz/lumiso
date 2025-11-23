import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { createSession } from "@/features/session-planning/api/sessionCreation";
import { useTranslation } from "react-i18next";

interface SessionFormData {
  session_name: string;
  session_date: string;
  session_time: string;
  notes: string;
  location: string;
  project_id?: string;
}

interface UseSessionFormProps {
  leadId: string;
  leadName: string;
  projectId?: string;
  onSuccess?: () => void;
}

export function useSessionForm({ leadId, leadName, projectId, onSuccess }: UseSessionFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SessionFormData>({
    session_name: "",
    session_date: "",
    session_time: "",
    notes: "",
    location: "",
    project_id: projectId || ""
  });

  const { triggerSessionScheduled } = useWorkflowTriggers();
  const { scheduleSessionReminders } = useSessionReminderScheduling();
  const { t } = useTranslation(["messages", "common"]);

  const handleInputChange = (field: keyof SessionFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      session_name: "",
      session_date: "",
      session_time: "",
      notes: "",
      location: "",
      project_id: projectId || ""
    });
  };

  const isDirty = Boolean(
    formData.session_name.trim() ||
    formData.session_date.trim() ||
    formData.session_time.trim() ||
    formData.notes.trim() ||
    formData.location.trim()
  );

  const isValid = Boolean(
    formData.session_name.trim() &&
    formData.session_date &&
    formData.session_time
  );

  const submitForm = async () => {
    if (!isValid) {
      toast({
        title: t("errors.validation", { ns: "messages" }),
        description: t("session.validationRequired", { ns: "messages" }),
        variant: "destructive"
      });
      return false;
    }

    setLoading(true);
    try {
      const resolvedProjectId = formData.project_id || projectId || undefined;

      const { sessionId, organizationId } = await createSession(
        {
          leadId,
          leadName,
          sessionName: formData.session_name.trim(),
          sessionDate: formData.session_date,
          sessionTime: formData.session_time,
          notes: formData.notes,
          location: formData.location,
          projectId: resolvedProjectId
        },
        {
          createActivity: !resolvedProjectId
        }
      );

      // Trigger workflow for session scheduled
      try {
        console.log(`🚀 Triggering session_scheduled workflow for session: ${sessionId}`);
        const workflowResult = await triggerSessionScheduled(sessionId, organizationId, {
          session_date: formData.session_date,
          session_time: formData.session_time,
          location: formData.location,
          client_name: leadName,
          lead_id: leadId,
          project_id: resolvedProjectId,
          status: 'planned'
        });
        console.log(`✅ Session workflow result:`, workflowResult);
      } catch (workflowError) {
        console.error('❌ Error triggering session_scheduled workflow:', workflowError);
        toast({
          title: t("toast.warning", { ns: "common" }), 
          description: t("session.notificationWarning", { ns: "messages" }),
          variant: "default"
        });
      }

      // Schedule session reminders
      try {
        console.log(`⏰ Scheduling reminders for session: ${sessionId}`);
        await scheduleSessionReminders(sessionId);
      } catch (reminderError) {
        console.error('❌ Error scheduling session reminders:', reminderError);
      }

      toast({
        title: t("toast.success", { ns: "common" }),
        description: t("session.scheduled", { ns: "messages" })
      });

      resetForm();
      onSuccess?.();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: t("session.scheduleError", { ns: "messages" }),
        description: message,
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    loading,
    isDirty,
    isValid,
    handleInputChange,
    resetForm,
    submitForm
  };
}
