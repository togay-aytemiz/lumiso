import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { ProjectSheetView } from "./ProjectSheetView";
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
import { useTranslation } from "react-i18next";
import { ProjectCreationWizardSheet } from "@/features/project-creation";

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
  const { t } = useTranslation(['pages', 'common']);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  
  const [showArchived, setShowArchived] = useState(false);
  const [hasArchived, setHasArchived] = useState(false);
  const [archivedStatusId, setArchivedStatusId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isProjectWizardOpen, setProjectWizardOpen] = useState(false);
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
        title: t('common:labels.error'),
        description: t('pages:projects.failedToLoadProjects'),
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
    // Navigate to full project page instead of opening dialog
    navigate(`/projects/${project.id}`);
  };

  const handleQuickViewProject = (project: Project) => {
    setViewingProject(project);
    setShowViewDialog(true);
    // Call tutorial callback immediately when project is clicked
    if (onProjectClicked) {
      // Project clicked, handling tutorial interaction
      onProjectClicked();
    }
  };

  const handleViewFullDetails = () => {
    if (viewingProject) {
      navigate(`/projects/${viewingProject.id}`);
      setShowViewDialog(false);
    }
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
        title: t('messages:success.saved'),
        description: t('pages:projects.projectDeletedSuccess'),
      });

      fetchProjects();
    } catch (error: any) {
      toast({
        title: t('pages:projects.errorDeletingProject'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setProjectToDelete(null);
    }
  };

  const handleWizardProjectCreated = () => {
    fetchProjects();
    setRefreshTrigger((prev) => prev + 1);
    onProjectUpdated?.();
  };

  const archivedId = archivedStatusId;
  const activeProjects = archivedId ? projects.filter((p) => p.status_id !== archivedId) : projects;
  const archivedProjects = archivedId ? projects.filter((p) => p.status_id === archivedId) : [];

  return (
    <>
      <ProjectCreationWizardSheet
        isOpen={isProjectWizardOpen}
        onOpenChange={setProjectWizardOpen}
        leadId={leadId}
        leadName={leadName}
        entrySource="dashboard_projects"
        onProjectCreated={handleWizardProjectCreated}
      />

      <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">{t('pages:projects.title')}</CardTitle>
        <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row md:items-center">
          {hasArchived && (
            <div className="flex items-center justify-between md:justify-start gap-2 text-sm text-muted-foreground">
              <span className="flex-shrink-0">{t('pages:projects.showArchived')}</span>
              <Switch checked={showArchived} onCheckedChange={(v) => setShowArchived(v)} />
            </div>
          )}
          {projects.length > 0 && (
            <Button
              size="sm"
              className="w-full md:w-auto"
              onClick={() => setProjectWizardOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('pages:projects.addProject')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse border rounded-lg p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="mb-4">{t('pages:projects.noProjectsYet')}</p>
            <Button
              variant="outline"
              onClick={() => setProjectWizardOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('pages:projects.addProject')}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {activeProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onView={handleViewProject}
                  onQuickView={handleQuickViewProject}
                  refreshTrigger={refreshTrigger}
                />
              ))}
            </div>
            {hasArchived && showArchived && archivedProjects.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">{t('pages:projects.archivedProjects')}</h3>
                <div className="space-y-4">
                  {archivedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onView={handleViewProject}
                      onQuickView={handleQuickViewProject}
                      refreshTrigger={refreshTrigger}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>



      <ProjectSheetView
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={(open) => {
          setShowViewDialog(open);
        }}
        onProjectUpdated={() => {
          fetchProjects();
          setRefreshTrigger(prev => prev + 1); // Force refresh progress bars
          onProjectUpdated?.(); // Notify parent component about project update
        }}
        onActivityUpdated={onActivityUpdated}
        leadName={leadName}
        mode="sheet"
        onViewFullDetails={handleViewFullDetails}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages:projects.deleteProject')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages:projects.deleteProjectConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common:buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('pages:projects.deleting') : t('common:buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
    </>
  );
}
