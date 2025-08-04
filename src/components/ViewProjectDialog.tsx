import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import SessionBanner from "./SessionBanner";
import { ProjectActivitySection } from "./ProjectActivitySection";
import EditSessionDialog from "./EditSessionDialog";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';
  project_id?: string;
  lead_id: string;
}

interface ViewProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
}

export function ViewProjectDialog({ project, open, onOpenChange, leadName }: ViewProjectDialogProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProjectSessions = async () => {
    if (!project) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('project_id', project.id)
        .order('session_date', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error: any) {
      console.error('Error fetching project sessions:', error);
      toast({
        title: "Error loading sessions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project && open) {
      fetchProjectSessions();
    }
  }, [project, open]);

  const handleSessionUpdated = () => {
    fetchProjectSessions();
    setEditingSessionId(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session deleted successfully."
      });

      fetchProjectSessions();
    } catch (error: any) {
      toast({
        title: "Error deleting session",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (!project) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{project.name}</DialogTitle>
            {project.description && (
              <p className="text-muted-foreground mt-2">{project.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Created on {format(new Date(project.created_at), "MMMM d, yyyy")}
            </p>
          </DialogHeader>
          
          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">Loading sessions...</div>
              </div>
            ) : sessions.length > 0 ? (
              <>
                <h3 className="text-lg font-medium">
                  This project includes {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                </h3>
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <SessionBanner
                      key={session.id}
                      session={session}
                      leadName={leadName}
                      projectName={project.name}
                      onStatusUpdate={handleSessionUpdated}
                      onEdit={() => setEditingSessionId(session.id)}
                      onDelete={() => handleDeleteSession(session.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No sessions linked to this project yet.</p>
              </div>
            )}
            
            {/* Project Activities Section */}
            <div className="mt-8 pt-6 border-t">
              <ProjectActivitySection
                projectId={project.id}
                leadId={project.lead_id}
                leadName={leadName}
                projectName={project.name}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      {editingSessionId && (() => {
        const session = sessions.find(s => s.id === editingSessionId);
        return session ? (
          <EditSessionDialog
            sessionId={session.id}
            leadId={session.lead_id}
            currentDate={session.session_date}
            currentTime={session.session_time}
            currentNotes={session.notes}
            currentProjectId={session.project_id}
            leadName={leadName}
            open={!!editingSessionId}
            onOpenChange={(open) => {
              if (!open) {
                setEditingSessionId(null);
              }
            }}
            onSessionUpdated={handleSessionUpdated}
          />
        ) : null;
      })()}
    </>
  );
}