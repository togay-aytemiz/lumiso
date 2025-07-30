import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScheduleSessionDialogProps {
  leadId: string;
  leadName: string;
  onSessionScheduled?: () => void;
}

const ScheduleSessionDialog = ({ leadId, leadName, onSessionScheduled }: ScheduleSessionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    session_date: "",
    session_time: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.session_date || !formData.session_time) {
      toast({
        title: "Validation error",
        description: "Session date and time are required.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // First check if lead status should be updated
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('status')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;

      // Update lead status to 'booked' if not already 'completed' or 'lost'
      if (leadData && !['completed', 'lost'].includes(leadData.status)) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ status: 'booked' })
          .eq('id', leadId);

        if (updateError) throw updateError;
      }

      const { error } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          session_date: formData.session_date,
          session_time: formData.session_time,
          notes: formData.notes.trim() || null
        });

      if (error) throw error;

      // Add activity entry for the scheduled session
      const sessionDate = new Date(formData.session_date).toLocaleDateString();
      const activityContent = `Photo session scheduled for ${sessionDate} at ${formData.session_time}`;
      
      const { error: activityError } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          type: 'note',
          content: activityContent
        });

      if (activityError) {
        console.error('Error creating activity:', activityError);
        // Don't throw here - session was created successfully
      }

      toast({
        title: "Success",
        description: "Session scheduled successfully.",
      });

      // Reset form and close dialog
      setFormData({
        session_date: "",
        session_time: "",
        notes: ""
      });
      setOpen(false);
      
      // Notify parent component
      if (onSessionScheduled) {
        onSessionScheduled();
      }
    } catch (error: any) {
      toast({
        title: "Error scheduling session",
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
        <Button>
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Session</DialogTitle>
          <DialogDescription>
            Schedule a photography session for {leadName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lead">Client</Label>
              <Input
                id="lead"
                value={leadName}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_date">Session Date *</Label>
              <Input
                id="session_date"
                type="date"
                value={formData.session_date}
                onChange={(e) => handleInputChange("session_date", e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_time">Session Time *</Label>
              <Input
                id="session_time"
                type="time"
                value={formData.session_time}
                onChange={(e) => handleInputChange("session_time", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Any special requirements or notes for this session..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleSessionDialog;