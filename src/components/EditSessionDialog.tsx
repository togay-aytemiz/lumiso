import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Edit, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.session_date || !formData.session_time) {
      toast({
        title: "Validation error",
        description: "Please fill in both date and time.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_date: formData.session_date,
          session_time: formData.session_time,
          notes: formData.notes.trim() || null
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Enter session notes (optional)"
              rows={3}
            />
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