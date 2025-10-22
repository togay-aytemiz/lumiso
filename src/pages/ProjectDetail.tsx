import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, X, ChevronDown, Pencil, Archive, ArchiveRestore, FolderKanban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectActivitySection } from "@/components/ProjectActivitySection";
import { ProjectTodoListEnhanced } from "@/components/ProjectTodoListEnhanced";
import { ProjectServicesSection } from "@/components/ProjectServicesSection";
import { SessionsSection } from "@/components/SessionsSection";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { SimpleProjectTypeSelect } from "@/components/SimpleProjectTypeSelect";
import { ProjectPaymentsSection } from "@/components/ProjectPaymentsSection";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
// AssigneesList removed - single user organization
import { SessionWithStatus } from "@/lib/sessionSorting";
import { onArchiveToggle } from "@/components/ViewProjectDialog";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { EntityHeader } from "@/components/EntityHeader";
import { buildProjectSummaryItems } from "@/lib/projects/buildProjectSummaryItems";
import { useProjectHeaderSummary } from "@/hooks/useProjectHeaderSummary";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
  previous_status_id?: string | null;
  project_type_id?: string | null;
  assignees?: string[];
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
}

interface Session extends SessionWithStatus {
  session_time: string;
  notes: string;
}

interface ProjectType {
  id: string;
  name: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useFormsTranslation();
  const { t: tPages } = useTranslation("pages");

  const [project, setProject] = useState<Project | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectTypeId, setEditProjectTypeId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [localStatusId, setLocalStatusId] = useState<string | null | undefined>(null);
  const [servicesVersion, setServicesVersion] = useState(0);
  const [summaryRefreshToken, setSummaryRefreshToken] = useState(0);

  const { summary: headerSummary } = useProjectHeaderSummary(project?.id, summaryRefreshToken);

  const fetchProject = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProject(data);
      setEditName(data.name);
      setEditDescription(data.description || "");
      setEditProjectTypeId(data.project_type_id || "");
    } catch (error: any) {
      console.error('Error fetching project:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive"
      });
      navigate('/projects');
    }
  };

  const fetchProjectSessions = async () => {
    if (!project) return;
    setSessionLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('project_id', project.id);
      
      if (error) throw error;
      setSessions(data as unknown as Session[]);
    } catch (error: any) {
      console.error('Error fetching project sessions:', error);
      toast({
        title: "Error loading sessions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSessionLoading(false);
    }
  };

  const fetchLead = async () => {
    if (!project?.lead_id) return;
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, status, notes')
        .eq('id', project.lead_id)
        .single();

      if (error) throw error;
      setLead(data);
    } catch (error: any) {
      console.error('Error fetching lead:', error);
    }
  };

  const fetchProjectType = async () => {
    if (!project?.project_type_id) return;
    
    try {
      const { data, error } = await supabase
        .from('project_types')
        .select('id, name')
        .eq('id', project.project_type_id)
        .single();

      if (error) throw error;
      setProjectType(data);
    } catch (error: any) {
      console.error('Error fetching project type:', error);
    }
  };

  const checkArchiveStatus = async () => {
    if (!project?.id) {
      setIsArchived(false);
      setLocalStatusId(null);
      return;
    }

    try {
      const { data: statusData } = await supabase
        .from('project_statuses')
        .select('id, name')
        .eq('id', project.status_id!)
        .maybeSingle();

      const archived = Boolean(statusData?.name && statusData.name.toLowerCase() === 'archived');
      setIsArchived(archived);

      const { data: projRow } = await supabase
        .from('projects')
        .select('status_id, previous_status_id')
        .eq('id', project.id)
        .single();

      if (archived) {
        setLocalStatusId(projRow?.previous_status_id || null);
      } else {
        setLocalStatusId(projRow?.status_id || null);
      }
    } catch {
      setIsArchived(false);
      setLocalStatusId(project?.status_id || null);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    if (project) {
      fetchLead();
      fetchProjectType();
      checkArchiveStatus();
      fetchProjectSessions();
      setLoading(false);
    }
  }, [project]);

  const handleSaveProject = async () => {
    if (!project || !editName.trim() || !editProjectTypeId) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: projectError } = await supabase
        .from('projects')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          project_type_id: editProjectTypeId
        })
        .eq('id', project.id);

      if (projectError) throw projectError;

      toast({
        title: "Success",
        description: "Project updated successfully."
      });

      if (editProjectTypeId) {
        try {
          const { data: typeData, error: typeError } = await supabase
            .from('project_types')
            .select('id, name')
            .eq('id', editProjectTypeId)
            .single();

          if (!typeError) {
            setProjectType(typeData);
          }
        } catch (typeError: any) {
          console.error('Error fetching updated project type:', typeError);
        }
      }

      setIsEditing(false);
      await fetchProject();
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
      // Delete all related data in the correct order
      const { error: servicesError } = await supabase
        .from('project_services')
        .delete()
        .eq('project_id', project.id);
      if (servicesError) throw servicesError;

      const { error: todosError } = await supabase
        .from('todos')
        .delete()
        .eq('project_id', project.id);
      if (todosError) throw todosError;

      const { error: sessionsError } = await supabase
        .from('sessions')
        .delete()
        .eq('project_id', project.id);
      if (sessionsError) throw sessionsError;

      const { error: activitiesError } = await supabase
        .from('activities')
        .delete()
        .eq('project_id', project.id);
      if (activitiesError) throw activitiesError;

      const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .eq('project_id', project.id);
      if (paymentsError) throw paymentsError;

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Project and all related data deleted successfully."
      });
      
      navigate('/projects');
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

  const handleArchiveAction = async () => {
    if (!project) return;
    
    try {
      const result = await onArchiveToggle(project);
      setIsArchived(result.isArchived);
      
      toast({
        title: "Success",
        description: result.isArchived ? "Project archived successfully." : "Project restored successfully."
      });
      
      await fetchProject();
      checkArchiveStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleAssigneesUpdate = () => {
    fetchProject();
  };

  const handleStatusChange = () => {
    fetchProject();
    checkArchiveStatus();
  };

  const triggerSummaryRefresh = () => {
    setSummaryRefreshToken(prev => prev + 1);
  };

  const summaryItems = useMemo(
    () => buildProjectSummaryItems({
      t: tPages,
      payments: headerSummary.payments,
      todos: headerSummary.todos,
      services: headerSummary.services,
      sessions
    }),
    [headerSummary, sessions, tPages]
  );

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const projectTypeLabel = projectType?.name || tPages("projectDetail.header.defaultType");
  const projectNameDisplay = project?.name || tPages("projectDetail.placeholders.name");
  const statusBadgeNode = (
    <ProjectStatusBadge
      projectId={project.id}
      currentStatusId={localStatusId || undefined}
      onStatusChange={handleStatusChange}
      editable={!isArchived}
      className="text-xs sm:text-sm"
    />
  );

  const headerTitle = (
    <span className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {projectTypeLabel}
      </span>
      <span className="flex items-center gap-2 text-foreground">
        <span className="truncate">{projectNameDisplay}</span>
        {statusBadgeNode}
      </span>
    </span>
  );

  const headerSubtext = !isEditing && project.description ? project.description : undefined;

  const headerActions = isEditing ? (
    <>
      <Button
        onClick={handleSaveProject}
        disabled={isSaving || !editName.trim() || !editProjectTypeId}
        size="sm"
        className="gap-2"
      >
        <Save className="h-4 w-4" />
        {isSaving ? t('common:actions.saving') : t('common:buttons.save')}
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setIsEditing(false);
          setEditName(project.name || "");
          setEditDescription(project.description || "");
          setEditProjectTypeId(project.project_type_id || "");
        }}
        disabled={isSaving}
        size="sm"
        className="gap-2"
      >
        <X className="h-4 w-4" />
        {tPages("projectDetail.actions.cancel")}
      </Button>
    </>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span>{t("project_sheet.more")}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem onSelect={() => setIsEditing(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          <span>{t("project_sheet.edit_project")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleArchiveAction}>
          {isArchived ? (
            <>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              <span>{t("project_sheet.restore_project")}</span>
            </>
          ) : (
            <>
              <Archive className="mr-2 h-4 w-4" />
              <span>{t("project_sheet.archive_project")}</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="w-full min-h-screen p-6">
      <div className="mb-6">
        <EntityHeader
          className="mb-4"
          name={project.name || ""}
          title={headerTitle}
          onBack={() => navigate(-1)}
          backLabel={tPages("projectDetail.header.back")}
          subtext={headerSubtext}
          summaryItems={summaryItems}
          avatarClassName="bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white ring-1 ring-blue-400/60"
          avatarContent={<FolderKanban className="h-5 w-5" />}
          actions={headerActions}
          fallbackInitials="PR"
        />
        {isEditing && (
          <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder={tPages("projectDetail.placeholders.name")}
                />
                <Textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder={tPages("projectDetail.placeholders.description")}
                  className="min-h-[120px] resize-none"
                />
              </div>
              <div className="space-y-3">
                <SimpleProjectTypeSelect
                  value={editProjectTypeId}
                  onValueChange={setEditProjectTypeId}
                  disabled={isSaving}
                  required
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Archive Warning */}
      {isArchived && (
        <div className="mb-6 rounded-lg border border-border bg-muted/40 text-muted-foreground text-sm px-4 py-3">
          {t('project_sheet.archived_banner')}
        </div>
      )}

      {/* Main Content - same layout but optimized for full page */}
      <div className={isArchived ? 'opacity-60 pointer-events-none select-none' : ''}>
        <ProjectDetailsLayout 
          header={<></>} 
          left={
            <div className="space-y-6">
              {lead && (
                <UnifiedClientDetails 
                  lead={lead} 
                  showClickableNames={true}
                  onLeadUpdated={() => {
                    fetchLead();
                  }} 
                />
              )}
            </div>
          } 
          sections={[
            {
              id: 'payments',
              title: t('project_sheet.payments_tab'),
              content: (
                <ProjectPaymentsSection
                  projectId={project!.id}
                  onPaymentsUpdated={() => {
                    triggerSummaryRefresh();
                  }}
                  refreshToken={servicesVersion}
                />
              )
            },
            {
              id: 'services',
              title: t('project_sheet.services_tab'),
              content: (
                <ProjectServicesSection
                  projectId={project!.id}
                  onServicesUpdated={() => {
                    setServicesVersion(v => v + 1);
                    triggerSummaryRefresh();
                  }}
                />
              )
            },
            {
              id: 'sessions',
              title: t('project_sheet.sessions_tab'),
              content: (
                <SessionsSection 
                  sessions={sessions} 
                  loading={sessionLoading} 
                  leadId={project!.lead_id} 
                  projectId={project!.id} 
                  leadName={lead?.name || ""} 
                  projectName={project!.name} 
                  onSessionUpdated={handleSessionUpdated} 
                  onDeleteSession={handleDeleteSession} 
                />
              )
            }, 
            {
              id: 'activities',
              title: t('project_sheet.activities_tab'),
              content: (
                <ProjectActivitySection 
                  projectId={project!.id} 
                  leadId={project!.lead_id} 
                  leadName={lead?.name || ""} 
                  projectName={project!.name} 
                  onActivityUpdated={() => {
                    // Handle activity updates if needed
                  }} 
                />
              )
            }, 
            {
              id: 'todos',
              title: t('project_sheet.todos_tab'),
              content: <ProjectTodoListEnhanced projectId={project!.id} onTodosUpdated={triggerSummaryRefresh} />
            }
          ]}
          rightFooter={
            <div className="border border-destructive/20 bg-destructive/5 rounded-md p-4">
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteDialog(true)} 
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  size="lg"
                >
                  {t('danger_zone.title')}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  {t('danger_zone.description')}
                </p>
              </div>
            </div>
          } 
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { name: project?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('actions.deleting') : t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
