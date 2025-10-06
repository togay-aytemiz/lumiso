import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { sessionSchema, sanitizeInput, sanitizeHtml } from "@/lib/validation";
import { ZodError } from "zod";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { generateSessionName } from "@/lib/sessionUtils";


interface SessionEditFormData {
  session_name: string;
  session_date: string;
  session_time: string;
  notes: string;
  location: string;
  project_id?: string;
}

interface UseSessionEditFormProps {
  sessionId: string;
  leadId: string;
  leadName: string;
  initialData: {
    session_name?: string;
    session_date: string;
    session_time: string;
    notes?: string;
    location?: string;
    project_id?: string;
  };
  onSuccess?: () => void;
}

export function useSessionEditForm({ 
  sessionId, 
  leadId, 
  leadName, 
  initialData, 
  onSuccess 
}: UseSessionEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<SessionEditFormData>({
    session_name: initialData.session_name || "",
    session_date: initialData.session_date,
    session_time: initialData.session_time,
    notes: initialData.notes || "",
    location: initialData.location || "",
    project_id: initialData.project_id || ""
  });

  const { triggerSessionRescheduled } = useWorkflowTriggers();
  const { rescheduleSessionReminders } = useSessionReminderScheduling();

  // Update form data when initial data changes (using primitive dependencies)
  useEffect(() => {
    setFormData(prev => {
      const newData = {
        session_name: initialData.session_name || "",
        session_date: initialData.session_date,
        session_time: initialData.session_time,
        notes: initialData.notes || "",
        location: initialData.location || "",
        project_id: initialData.project_id || ""
      };
      
      // Only update if data actually changed to prevent unnecessary rerenders
      if (JSON.stringify(prev) !== JSON.stringify(newData)) {
        return newData;
      }
      return prev;
    });
  }, [
    initialData.session_name,
    initialData.session_date,
    initialData.session_time,
    initialData.notes,
    initialData.location,
    initialData.project_id
  ]);


  const handleInputChange = (field: keyof SessionEditFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear field-specific errors when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const resetForm = () => {
    setFormData({
      session_name: initialData.session_name || "",
      session_date: initialData.session_date,
      session_time: initialData.session_time,
      notes: initialData.notes || "",
      location: initialData.location || "",
      project_id: initialData.project_id || ""
    });
    setErrors({});
  };

  const isDirty = Boolean(
    formData.session_name !== (initialData.session_name || "") ||
    formData.session_date !== initialData.session_date ||
    formData.session_time !== initialData.session_time ||
    formData.notes !== (initialData.notes || "") ||
    formData.location !== (initialData.location || "") ||
    formData.project_id !== (initialData.project_id || "")
  );

  const isValid = Boolean(
    formData.session_date &&
    formData.session_time &&
    Object.keys(errors).length === 0
  );

  const validateForm = async () => {
    setErrors({});
    
    try {
      await sessionSchema.parseAsync({
        session_date: sanitizeInput(formData.session_date),
        session_time: sanitizeInput(formData.session_time),
        notes: formData.notes ? await sanitizeHtml(formData.notes) : undefined
      });
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          const field = err.path[0] as string;
          newErrors[field] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const submitForm = async () => {
    if (!(await validateForm())) {
      toast({
        title: "Validation error",
        description: "Please fix the validation errors before saving.",
        variant: "destructive"
      });
      return false;
    }

    if (!isValid) {
      toast({
        title: "Validation error",
        description: "Date and time are required.",
        variant: "destructive"
      });
      return false;
    }

    setLoading(true);
    try {
      // Check if date/time changed for workflow trigger
      const dateTimeChanged = 
        formData.session_date !== initialData.session_date || 
        formData.session_time !== initialData.session_time;
      const oldDateTime = `${initialData.session_date} ${initialData.session_time}`;
      const newDateTime = `${formData.session_date} ${formData.session_time}`;

      // Generate session name if empty
      const finalSessionName = formData.session_name.trim() || 
        generateSessionName(leadName || "Client");

      const { error } = await supabase
        .from('sessions')
        .update({
          session_name: sanitizeInput(finalSessionName),
          session_date: sanitizeInput(formData.session_date),
          session_time: sanitizeInput(formData.session_time),
          notes: formData.notes ? await sanitizeHtml(formData.notes) : null,
          location: formData.location.trim() || null,
          project_id: formData.project_id || null
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Trigger workflow for session rescheduled if date/time changed
      if (dateTimeChanged) {
        try {
          const organizationId = await getUserOrganizationId();
          if (organizationId) {
            await triggerSessionRescheduled(sessionId, organizationId, oldDateTime, newDateTime, {
              session_date: formData.session_date,
              session_time: formData.session_time,
              location: formData.location,
              client_name: leadName,
              lead_id: leadId,
              project_id: formData.project_id || null
            });
          }
        } catch (workflowError) {
          console.error('Error triggering rescheduled workflow:', workflowError);
          // Don't block session update if workflow fails
        }
      }

      // Reschedule session reminders if date/time changed
      if (dateTimeChanged) {
        try {
          await rescheduleSessionReminders(sessionId);
        } catch (reminderError) {
          console.error('Error rescheduling session reminders:', reminderError);
          // Don't block session update if reminder scheduling fails
        }
      }

      toast({
        title: "Success",
        description: "Session updated successfully."
      });

      onSuccess?.();
      return true;
    } catch (error: any) {
      toast({
        title: "Error updating session",
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
    errors,
    isDirty,
    isValid,
    handleInputChange,
    resetForm,
    submitForm
  };
}