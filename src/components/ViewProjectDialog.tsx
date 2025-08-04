import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ProjectActivitySection } from "./ProjectActivitySection";
import { ProjectTodoList } from "./ProjectTodoList";
import { ProjectServicesSection } from "./ProjectServicesSection";
import { SessionsSection } from "./SessionsSection";

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
  onProjectUpdated: () => void;
  onActivityUpdated?: () => void;
  leadName: string;
}

export function ViewProjectDialog({ project, open, onOpenChange, onProjectUpdated, onActivityUpdated, leadName }: ViewProjectDialogProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
      setEditName(project.name);
      setEditDescription(project.description || "");
      setIsEditing(false);
    }
  }, [project, open]);

  const handleSaveProject = async () => {
    if (!project || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update project details
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null
        })
        .eq('id', project.id);

      if (projectError) throw projectError;


      toast({
        title: "Success",
        description: "Project updated successfully."
      });

      setIsEditing(false);
      onProjectUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project deleted successfully."
      });

      onOpenChange(false);
      onProjectUpdated();
    } catch (error: any) {
      toast({
        title: "Error deleting project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

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
      <Dialog open={open} onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) {
          // Trigger refresh of project data when modal closes
          onProjectUpdated();
        }
      }}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Project name"
                        className="text-xl font-semibold"
                      />
                    </div>
                    <div>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Project description (optional)"
                        className="text-base resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleSaveProject}
                        disabled={isSaving || !editName.trim()}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setIsEditing(false);
                          setEditName(project?.name || "");
                          setEditDescription(project?.description || "");
                          
                        }}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-semibold">{project?.name}</DialogTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {project?.description && (
                      <p className="text-muted-foreground text-base">{project.description}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Created on {project && format(new Date(project.created_at), "MMMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <div className="mt-6 space-y-6">
            {/* Project Services Section - Prominently displayed */}
            <ProjectServicesSection
              projectId={project.id}
              onServicesUpdated={() => {
                onProjectUpdated();
                onActivityUpdated?.();
              }}
            />
            
            {/* Sessions Section */}
            <SessionsSection
              sessions={sessions}
              loading={loading}
              leadName={leadName}
              projectName={project.name}
              onSessionUpdated={handleSessionUpdated}
              onDeleteSession={handleDeleteSession}
            />
            
            {/* Project Activities Section */}
            <ProjectActivitySection
              projectId={project.id}
              leadId={project.lead_id}
              leadName={leadName}
              projectName={project.name}
              onActivityUpdated={onActivityUpdated}
            />
            
            {/* Project Todos Section */}
            <ProjectTodoList projectId={project.id} />
            
            {/* Delete Project Section */}
            <div className="mt-8 pt-6 border-t">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full"
              >
                Delete Project
              </Button>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Deleting this project will not remove sessions, notes, or reminders.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project?.name}"? This action cannot be undone.
              Sessions, notes, and reminders will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}