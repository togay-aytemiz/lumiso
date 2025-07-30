import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Edit, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { sessionSchema, sanitizeInput, sanitizeHtml } from "@/lib/validation";
import { ZodError } from "zod";

interface EditSessionDialogProps {
  sessionId: string;
  currentDate: string;
  currentTime: string;
  currentNotes: string;
  onSessionUpdated?: () => void;
}

const EditSessionDialog = ({ sessionId, currentDate, currentTime, currentNotes, onSessionUpdated }: EditSessionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    session_date: currentDate,
    session_time: currentTime,
    notes: currentNotes || ""
  });

  useEffect(() => {
    setFormData({
      session_date: currentDate,
      session_time: currentTime,
      notes: currentNotes || ""
    });
  }, [currentDate, currentTime, currentNotes]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!(await validateForm())) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_date: sanitizeInput(formData.session_date),
          session_time: sanitizeInput(formData.session_time),
          notes: formData.notes ? await sanitizeHtml(formData.notes) : null
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session updated successfully."
      });

      setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Edit Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session_date">Date</Label>
            <Input
              id="session_date"
              type="date"
              value={formData.session_date}
              onChange={(e) => handleInputChange("session_date", e.target.value)}
              required
            />
            {errors.session_date && <p className="text-sm text-destructive">{errors.session_date}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="session_time">Time</Label>
            <Input
              id="session_time"
              type="time"
              value={formData.session_time}
              onChange={(e) => handleInputChange("session_time", e.target.value)}
              required
            />
            {errors.session_time && <p className="text-sm text-destructive">{errors.session_time}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Enter session notes (optional)"
              maxLength={1000}
              rows={3}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Updating..." : "Update Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSessionDialog;