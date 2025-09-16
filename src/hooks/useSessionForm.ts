import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { formatDate, formatTime } from "@/lib/utils";

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
        title: "Validation error",
        description: "Session name, date and time are required.",
        variant: "destructive"
      });
      return false;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user organization
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const organizationId = await getUserOrganizationId();

      if (!organizationId) {
        throw new Error("Organization required");
      }

      // Update lead status to 'booked' if from lead detail (when no fixed projectId)
      if (!projectId) {
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .select('status')
          .eq('id', leadId)
          .single();

        if (leadError) throw leadError;

        if (leadData && !['completed', 'lost'].includes(leadData.status)) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ status: 'booked' })
            .eq('id', leadId);

          if (updateError) throw updateError;
        }
      }

      // Create session
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
      organization_id: organizationId,
          lead_id: leadId,
          session_name: formData.session_name.trim(),
          session_date: formData.session_date,
          session_time: formData.session_time,
          notes: formData.notes.trim() || null,
          location: formData.location.trim() || null,
          project_id: formData.project_id || null
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;


      // Trigger workflow for session scheduled
      try {
        console.log(`🚀 Triggering session_scheduled workflow for session: ${newSession.id}`);
        const workflowResult = await triggerSessionScheduled(newSession.id, organizationId, {
          session_date: formData.session_date,
          session_time: formData.session_time,
          location: formData.location,
          client_name: leadName,
          lead_id: leadId,
          project_id: formData.project_id,
          status: 'planned'
        });
        console.log(`✅ Session workflow result:`, workflowResult);
      } catch (workflowError) {
        console.error('❌ Error triggering session_scheduled workflow:', workflowError);
        toast({
          title: "Warning", 
          description: "Session created successfully, but notifications may not be sent.",
          variant: "default"
        });
      }

      // Schedule session reminders
      try {
        console.log(`⏰ Scheduling reminders for session: ${newSession.id}`);
        await scheduleSessionReminders(newSession.id);
      } catch (reminderError) {
        console.error('❌ Error scheduling session reminders:', reminderError);
      }

      // Add activity entry for sessions from lead detail (not from project)
      if (!projectId) {
        const sessionDate = formatDate(formData.session_date);
        const sessionTime = formatTime(formData.session_time);
        const activityContent = `Photo session scheduled for ${sessionDate} at ${sessionTime}`;
        
        const { error: activityError } = await supabase
          .from('activities')
          .insert({
            user_id: user.id,
            organization_id: organizationId,
            lead_id: leadId,
            type: 'note',
            content: activityContent
          });

        if (activityError) {
          console.error('Error creating activity:', activityError);
        }
      }

      toast({
        title: "Success",
        description: "Session scheduled successfully."
      });

      resetForm();
      onSuccess?.();
      return true;
    } catch (error: any) {
      toast({
        title: "Error scheduling session",
        description: error.message,
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