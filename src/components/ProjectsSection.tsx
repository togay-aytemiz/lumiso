import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { ViewProjectDialog } from "./ViewProjectDialog";
import { EnhancedProjectDialog } from "./EnhancedProjectDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
}

interface ProjectsSectionProps {
  leadId: string;
  leadName?: string;
  onProjectUpdated?: () => void;
  onActivityUpdated?: () => void;
  onProjectClicked?: () => void;
}

export function ProjectsSection({ leadId, leadName = "", onProjectUpdated, onActivityUpdated, onProjectClicked }: ProjectsSectionProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [showArchived, setShowArchived] = useState(false);
  const [hasArchived, setHasArchived] = useState(false);
  const [archivedStatusId, setArchivedStatusId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      // Find archived status id (if any)
      const { data: archived, error: archErr } = await supabase
        .from('project_statuses')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('name', 'archived')
        .maybeSingle();
      if (archErr) throw archErr;
      const archivedId = archived?.id as string | undefined;
      setArchivedStatusId(archivedId ?? null);

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("lead_id", leadId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const all = data || [];
      const hasArch = archivedId ? all.some((p: any) => p.status_id === archivedId) : false;
      setHasArchived(hasArch);
      setProjects(all);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load projects.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [leadId]);

  // Persist "Show archived" preference per user
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const saved = localStorage.getItem(`crm:showArchivedProjects:${user.id}`);
      if (saved !== null) setShowArchived(saved === 'true');
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`crm:showArchivedProjects:${userId}`, String(showArchived));
  }, [showArchived, userId]);


  const handleViewProject = (project: Project) => {
    setViewingProject(project);
    setShowViewDialog(true);
    // Call the callback to advance tutorial if provided
    onProjectClicked?.();
  };

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project deleted successfully.",
      });

      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error deleting project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setProjectToDelete(null);
    }
  };

  const archivedId = archivedStatusId;
  const activeProjects = archivedId ? projects.filter((p) => p.status_id !== archivedId) : projects;
  const archivedProjects = archivedId ? projects.filter((p) => p.status_id === archivedId) : [];

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Projects</CardTitle>
        <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row md:items-center">
          {hasArchived && (
            <div className="flex items-center justify-between md:justify-start gap-2 text-sm text-muted-foreground">
              <span className="flex-shrink-0">Show archived</span>
              <Switch checked={showArchived} onCheckedChange={(v) => setShowArchived(v)} />
            </div>
          )}
          {projects.length > 0 && (
            <EnhancedProjectDialog
              defaultLeadId={leadId}
              onProjectCreated={() => {
                fetchProjects();
                setRefreshTrigger(prev => prev + 1);
                onProjectUpdated?.();
              }}
            >
              <Button size="sm" className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </EnhancedProjectDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="mb-4">No projects created yet.</p>
            <EnhancedProjectDialog
              defaultLeadId={leadId}
              onProjectCreated={() => {
                fetchProjects();
                setRefreshTrigger(prev => prev + 1);
                onProjectUpdated?.();
              }}
            >
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </EnhancedProjectDialog>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {activeProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onView={handleViewProject}
                  refreshTrigger={refreshTrigger}
                />
              ))}
            </div>
            {hasArchived && showArchived && archivedProjects.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Archived Projects</h3>
                <div className="space-y-4">
                  {archivedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onView={handleViewProject}
                      refreshTrigger={refreshTrigger}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>



      <ViewProjectDialog
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onProjectUpdated={() => {
          fetchProjects();
          setRefreshTrigger(prev => prev + 1); // Force refresh progress bars
          onProjectUpdated?.(); // Notify parent component about project update
        }}
        onActivityUpdated={onActivityUpdated}
        leadName={leadName}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will not affect any sessions or notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}