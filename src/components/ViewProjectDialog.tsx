import { useState, useEffect, useCallback } from "react";
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
import { ProjectTodoListEnhanced } from "./ProjectTodoListEnhanced";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  
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
      setIsFullscreen(false);
    }
  }, [project, open]);

  // Handle ESC key for fullscreen mode
  const handleDialogOpenChange = (newOpen: boolean) => {
    // If we're in fullscreen mode and user tries to close (ESC or other means)
    if (!newOpen && isFullscreen) {
      // Instead of closing, just exit fullscreen
      setIsFullscreen(false);
      return; // Don't close the modal
    }
    
    // Normal behavior - close the modal
    if (!newOpen) {
      onOpenChange(newOpen);
      onProjectUpdated();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

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
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={`${isFullscreen ? 'max-w-none w-[100vw] h-[100vh] m-0 rounded-none' : 'sm:max-w-5xl max-h-[85vh]'} overflow-y-auto [&>button]:hidden`}>
          <DialogHeader className="pb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Project name"
                        className="text-2xl font-bold border rounded-md px-3 py-2"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Project description (optional)"
                        className="text-base border rounded-md px-3 py-2 resize-none"
                        rows={2}
                      />
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
                  <div className="space-y-1">
                    <DialogTitle className="text-2xl font-bold leading-tight">{project?.name}</DialogTitle>
                    {project?.description && (
                      <p className="text-muted-foreground text-base">{project.description}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Created on {project && format(new Date(project.created_at), "MMMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="text-muted-foreground hover:text-foreground text-sm h-10 px-3"
                  >
                    Edit
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleFullscreen}
                  className="text-muted-foreground hover:text-foreground h-10 w-10 p-0"
                >
                  {isFullscreen ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 0V3m0 6l6-6M15 15v6m0-6H9m6 0l-6 6" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-muted-foreground hover:text-foreground text-sm h-10 px-3"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-8">
            {/* Project Services Section */}
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
              leadId={project.lead_id}
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
            
            {/* Enhanced Todos Section with inline addition */}
            <ProjectTodoListEnhanced projectId={project.id} />
            
            {/* Delete Project Section - Danger Zone */}
            <div className="pt-6 border-t border-destructive/20 bg-destructive/5 -mx-6 px-6 -mb-6 pb-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  Delete Project
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  This will not delete sessions, notes, or reminders.
                </p>
              </div>
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