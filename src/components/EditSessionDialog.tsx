import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { sessionSchema, sanitizeInput, sanitizeHtml } from "@/lib/validation";
import { ZodError } from "zod";
import { useCalendarSync } from "@/hooks/useCalendarSync";

interface EditSessionDialogProps {
  sessionId: string;
  leadId: string;
  currentDate: string;
  currentTime: string;
  currentNotes: string;
  currentProjectId?: string;
  leadName?: string;
  onSessionUpdated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const EditSessionDialog = ({ sessionId, leadId, currentDate, currentTime, currentNotes, currentProjectId, leadName, onSessionUpdated, open = false, onOpenChange }: EditSessionDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    session_date: currentDate,
    session_time: currentTime,
    notes: currentNotes || "",
    project_id: currentProjectId || ""
  });
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const { updateSessionEvent } = useCalendarSync();

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('lead_id', leadId)
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setProjects(projectsData || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  useEffect(() => {
    setFormData({
      session_date: currentDate,
      session_time: currentTime,
      notes: currentNotes || "",
      project_id: currentProjectId || ""
    });
  }, [currentDate, currentTime, currentNotes, currentProjectId]);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

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

  const handleSubmit = async () => {
    if (!(await validateForm())) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_date: sanitizeInput(formData.session_date),
          session_time: sanitizeInput(formData.session_time),
          notes: formData.notes ? await sanitizeHtml(formData.notes) : null,
          project_id: formData.project_id || null
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Sync to Google Calendar
      if (leadName) {
        updateSessionEvent(
          {
            id: sessionId,
            lead_id: '', // Not needed for update
            session_date: sanitizeInput(formData.session_date),
            session_time: sanitizeInput(formData.session_time),
            notes: formData.notes ? await sanitizeHtml(formData.notes) : undefined
          },
          { name: leadName }
        );
      }

      toast({
        title: "Success",
        description: "Session updated successfully."
      });

      onOpenChange?.(false);
      onSessionUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error updating session",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isDirty = Boolean(
    formData.session_date !== currentDate ||
    formData.session_time !== currentTime ||
    formData.notes !== (currentNotes || "") ||
    formData.project_id !== (currentProjectId || "")
  );

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      if (onOpenChange) {
        onOpenChange(false);
      }
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => onOpenChange && onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Updating..." : "Update Session",
      onClick: handleSubmit,
      disabled: loading || !formData.session_date.trim() || !formData.session_time.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Edit Session"
      isOpen={open}
      onOpenChange={onOpenChange || (() => {})}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="session_date">Date *</Label>
          <Input
            id="session_date"
            type="date"
            value={formData.session_date}
            onChange={(e) => handleInputChange("session_date", e.target.value)}
            className="w-full"
          />
          {errors.session_date && <p className="text-sm text-destructive">{errors.session_date}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session_time">Time *</Label>
          <Input
            id="session_time"
            type="time"
            value={formData.session_time}
            onChange={(e) => handleInputChange("session_time", e.target.value)}
            className="w-full"
          />
          {errors.session_time && <p className="text-sm text-destructive">{errors.session_time}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project_id">Project</Label>
          <Select value={formData.project_id} onValueChange={(value) => handleInputChange("project_id", value)} disabled={projects.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={projects.length === 0 ? "No projects available" : "Select a project"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No specific project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="Session notes..."
            rows={3}
          />
        </div>
      </div>
    </AppSheetModal>
  );
};

export default EditSessionDialog;