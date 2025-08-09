import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCalendarSync } from "@/hooks/useCalendarSync";

interface NewSessionDialogForProjectProps {
  leadId: string;
  leadName: string;
  projectName: string;
  projectId: string;
  onSessionScheduled?: () => void;
}

export function NewSessionDialogForProject({ 
  leadId, 
  leadName, 
  projectName,
  projectId, 
  onSessionScheduled 
}: NewSessionDialogForProjectProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { createSessionEvent } = useCalendarSync();
  
  const [sessionData, setSessionData] = useState({
    session_date: "",
    session_time: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionData.session_date || !sessionData.session_time) {
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

      // Create session with the specific project ID
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          session_date: sessionData.session_date,
          session_time: sessionData.session_time,
          notes: sessionData.notes.trim() || null,
          project_id: projectId
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // Sync to Google Calendar
      if (newSession) {
        createSessionEvent(
          {
            id: newSession.id,
            lead_id: leadId,
            session_date: sessionData.session_date,
            session_time: sessionData.session_time,
            notes: sessionData.notes.trim() || undefined
          },
          { name: leadName }
        );
      }

      toast({
        title: "Success",
        description: "Session scheduled successfully."
      });

      // Reset form and close dialog
      setSessionData({
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

  const handleInputChange = (field: keyof typeof sessionData, value: string) => {
    setSessionData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Session</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Session</DialogTitle>
          <DialogDescription>
            Schedule a photography session for {leadName} in {projectName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input
                id="client"
                value={leadName}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Input
                id="project"
                value={projectName}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_date">Session Date *</Label>
              <Input
                id="session_date"
                type="date"
                value={sessionData.session_date}
                onChange={(e) => handleInputChange("session_date", e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_time">Session Time *</Label>
              <Input
                id="session_time"
                type="time"
                value={sessionData.session_time}
                onChange={(e) => handleInputChange("session_time", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Session Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={sessionData.notes}
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
}