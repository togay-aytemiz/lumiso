import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Save, X, ChevronDown, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectActivitySection } from "./ProjectActivitySection";
import { ProjectTodoList } from "./ProjectTodoList";
import { ProjectServicesSection } from "./ProjectServicesSection";
import { SessionsSection } from "./SessionsSection";
import { ProjectTodoListEnhanced } from "./ProjectTodoListEnhanced";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { ProjectTypeSelector } from "./ProjectTypeSelector";
import { ProjectPaymentsSection } from "./ProjectPaymentsSection";
import { ProjectPackageSummaryCard } from "@/components/ProjectPackageSummaryCard";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import { useSessionActions } from "@/hooks/useSessionActions";
import { onArchiveToggle } from "@/components/projectArchiveToggle";
import { parseProjectPackageSnapshot } from "@/lib/projects/projectPackageSnapshot";
import { ProjectCreationWizardSheet } from "@/features/project-creation";
import type { ProjectCreationStepId } from "@/features/project-creation/types";
import type { ProjectPackageSnapshot } from "@/lib/projects/projectPackageSnapshot";
import { useTranslation } from "react-i18next";
// AssigneesList removed - single user organization
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
  package_id?: string | null;
  package_snapshot?: ProjectPackageSnapshot | null;
}
interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
}
interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  status_id?: string | null;
  project_id?: string;
  lead_id: string;
  session_statuses?: {
    id: string;
    name: string;
    lifecycle: string;
  } | null;
  projects?: {
    name: string;
    project_types?: {
      name: string;
    };
  };
}
interface ViewProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectUpdated: () => void;
  onActivityUpdated?: () => void;
  leadName: string;
}

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function ViewProjectDialog({
  project,
  open,
  onOpenChange,
  onProjectUpdated,
  onActivityUpdated,
  leadName
}: ViewProjectDialogProps) {
  const { t: tForms } = useFormsTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectTypeId, setEditProjectTypeId] = useState("");
  const [projectType, setProjectType] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [servicesVersion, setServicesVersion] = useState(0);
  const [isArchived, setIsArchived] = useState(false);
  const [editWizardOpen, setEditWizardOpen] = useState(false);
  const [editWizardStartStep, setEditWizardStartStep] =
    useState<ProjectCreationStepId>("details");
  const [localStatusId, setLocalStatusId] = useState<string | null | undefined>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const packageSnapshot = useMemo(
    () => parseProjectPackageSnapshot(project?.package_snapshot),
    [project?.package_snapshot]
  );
  const {
    toast
  } = useToast();
  const { t } = useTranslation(["messages", "common"]);
  const { deleteSession } = useSessionActions();
  const fetchProjectSessions = useCallback(async () => {
    const projectId = project?.id;
    if (!projectId) return;
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('sessions').select('*').eq('project_id', projectId);
      if (error) throw error;
      setSessions(data as unknown as Session[]);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('Error fetching project sessions:', error);
      toast({
        title: tForms('viewProject.errorLoadingSessions'),
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [project?.id, tForms, toast]);

  const fetchLead = useCallback(async () => {
    const leadId = project?.lead_id;
    if (!leadId) return;
    try {
      const {
        data,
        error
      } = await supabase.from('leads').select('id, name, email, phone, status, notes').eq('id', leadId).single();
      if (error) throw error;
      setLead(data);
    } catch (error) {
      console.error('Error fetching lead:', error);
    }
  }, [project?.lead_id]);

  const sectionId = {
    payments: "project-dialog-payments",
    services: "project-dialog-services",
    sessions: "project-dialog-sessions",
    activities: "project-dialog-activities",
    todos: "project-dialog-todos"
  } as const;

  const dialogNavOffset = 24;

  const openEditWizard = useCallback((step: ProjectCreationStepId) => {
    setEditWizardStartStep(step);
    setEditWizardOpen(true);
  }, []);

  const handleWizardUpdated = useCallback(() => {
    onProjectUpdated();
    setServicesVersion(prev => prev + 1);
    void fetchLead();
  }, [fetchLead, onProjectUpdated]);

  const fetchProjectType = useCallback(async () => {
    const projectTypeId = project?.project_type_id;
    if (!projectTypeId) return;
    try {
      const {
        data,
        error
      } = await supabase.from('project_types').select('id, name').eq('id', projectTypeId).single();
      if (error) throw error;
      setProjectType(data);
    } catch (error) {
      console.error('Error fetching project type:', error);
    }
  }, [project?.project_type_id]);
  const handleAssigneesUpdate = () => {
    onProjectUpdated();
  };

  useEffect(() => {
    if (project && open) {
      void fetchProjectSessions();
      void fetchProjectType();
      void fetchLead();
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditProjectTypeId(project.project_type_id || "");
      setIsEditing(false);

      // Auto-fullscreen on mobile
      const isMobile = window.innerWidth <= 768;
      setIsFullscreen(isMobile);
      setLocalStatusId(project.status_id || null);
    }
  }, [fetchLead, fetchProjectSessions, fetchProjectType, open, project]);
  useEffect(() => {
    const fetchStatus = async () => {
      if (!project?.id) {
        setIsArchived(false);
        setLocalStatusId(null);
        return;
      }
      try {
        // Determine if current status is Archived
        const {
          data: statusData
        } = await supabase.from('project_statuses').select('id, name').eq('id', project.status_id!).maybeSingle();
        const archived = Boolean(statusData?.name && statusData.name.toLowerCase() === 'archived');
        setIsArchived(archived);

        // Always fetch latest previous/current from DB to avoid stale props
        const {
          data: projRow
        } = await supabase.from('projects').select('status_id, previous_status_id').eq('id', project.id).single();
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
    fetchStatus();
  }, [project?.id, project?.status_id, open]);

  // Handle ESC key for fullscreen mode
  const handleDialogOpenChange = (newOpen: boolean) => {
    // If we're in fullscreen mode and user tries to close (ESC or click outside)
    if (!newOpen && isFullscreen) {
      // On mobile, don't allow exiting fullscreen, just close the modal
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        onOpenChange(newOpen);
        onProjectUpdated();
        onActivityUpdated?.();
        return;
      }
      setIsFullscreen(false);
      return;
    }
    if (!newOpen) {
      onOpenChange(newOpen);
      onProjectUpdated();
      onActivityUpdated?.();
    }
  };
  const toggleFullscreen = () => {
    // Don't allow toggle on mobile - it's always fullscreen
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      setIsFullscreen(!isFullscreen);
    }
  };
  const handleSaveProject = async () => {
    if (!project || !editName.trim() || !editProjectTypeId) return;
    setIsSaving(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update project details
      const {
        error: projectError
      } = await supabase.from('projects').update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        project_type_id: editProjectTypeId
      }).eq('id', project.id);
      if (projectError) throw projectError;
      toast({
        title: tForms("success.saved"),
        description: tForms("viewProject.projectUpdated")
      });

      // Update the project type display immediately with the new data
      if (editProjectTypeId) {
        try {
          const {
            data: typeData,
            error: typeError
          } = await supabase.from('project_types').select('id, name').eq('id', editProjectTypeId).single();
          if (!typeError) {
            setProjectType(typeData);
          }
        } catch (typeError) {
          console.error('Error fetching updated project type:', typeError);
        }
      }
      setIsEditing(false);
      onProjectUpdated();
    } catch (error) {
      const message = getErrorMessage(error);
      toast({
        title: tForms('viewProject.errorUpdatingProject'),
        description: message,
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
      // Delete all related data in the correct order to avoid foreign key constraints

      // Delete project services
      const {
        error: servicesError
      } = await supabase.from('project_services').delete().eq('project_id', project.id);
      if (servicesError) throw servicesError;

      // Delete todos
      const {
        error: todosError
      } = await supabase.from('todos').delete().eq('project_id', project.id);
      if (todosError) throw todosError;

      // Delete sessions and their reminders using centralized logic
      const { data: projectSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('project_id', project.id);
      
      if (projectSessions && projectSessions.length > 0) {
        for (const session of projectSessions) {
          await deleteSession(session.id);
        }
      }

      // Delete activities related to this project
      const {
        error: activitiesError
      } = await supabase.from('activities').delete().eq('project_id', project.id);
      if (activitiesError) throw activitiesError;

      // Delete payments
      const {
        error: paymentsError
      } = await supabase.from('payments').delete().eq('project_id', project.id);
      if (paymentsError) throw paymentsError;

      // Finally, delete the project itself
      const {
        error
      } = await supabase.from('projects').delete().eq('id', project.id);
      if (error) throw error;
      toast({
        title: tForms("success.saved"),
        description: tForms("viewProject.projectDeleted")
      });
      onOpenChange(false);
      onProjectUpdated();
    } catch (error) {
      const message = getErrorMessage(error);
      toast({
        title: tForms('viewProject.errorDeletingProject'),
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  const handleSessionUpdated = () => {
    fetchProjectSessions();
    onProjectUpdated(); // Propagate to parent
    setEditingSessionId(null);
    onProjectUpdated(); // Notify parent component to refresh sessions
  };
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const {
        error
      } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (error) throw error;
      toast({
        title: tForms("success.saved"),
        description: tForms("viewProject.sessionDeleted")
      });
      fetchProjectSessions();
      onProjectUpdated(); // Notify parent component to refresh sessions
    } catch (error) {
      const message = getErrorMessage(error);
      toast({
        title: tForms('viewProject.errorDeletingSession'),
        description: message,
        variant: "destructive"
      });
    }
  };
  const handleArchiveAction = async () => {
    if (!project) return;
    try {
      const res = await onArchiveToggle({
        id: project.id,
        status_id: project.status_id
      });
      setIsArchived(res.isArchived);

      // Fetch latest status values from DB to avoid stale props
      const {
        data: projRow
      } = await supabase.from('projects').select('status_id, previous_status_id').eq('id', project.id).single();
      setLocalStatusId(res.isArchived ? projRow?.previous_status_id || null : projRow?.status_id || null);
      onProjectUpdated();
    } catch (e) {
      const message = getErrorMessage(e);
      toast({
        title: t("error.actionFailed", { ns: "messages" }),
        description: message || t("error.archiveUpdateFailed", { ns: "messages" }),
        variant: 'destructive'
      });
    }
  };
  if (!project) return null;
  return <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          ref={scrollContainerRef}
          className={`${isFullscreen ? 'max-w-none w-[100vw] h-[100vh] m-0 rounded-none overflow-y-auto' : 'sm:max-w-5xl max-h-[85vh] overflow-y-auto'} overscroll-contain pr-2 [&>button]:hidden pt-8 sm:pt-6`}
        >
          <div className="max-w-full overflow-x-hidden">
          <DialogHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0 space-y-3">
                {isEditing ? <div className="space-y-3 text-2xl font-bold text-left">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder={tForms('projects.projectName')} className="text-2xl font-bold border rounded-md px-3 py-2" />
                      <Textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        placeholder={t("labels.project_description", { ns: "common" })}
                        className="text-base border rounded-md px-3 py-2 resize-none"
                        rows={2}
                      />
                      <ProjectTypeSelector value={editProjectTypeId} onValueChange={setEditProjectTypeId} disabled={isSaving} required />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProject} disabled={isSaving || !editName.trim() || !editProjectTypeId}>
                        <Save className="h-4 w-4 mr-1" />
                        {isSaving ? tForms('projects.saving') : tForms('projects.save')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                      setIsEditing(false);
                      setEditName(project?.name || "");
                      setEditDescription(project?.description || "");
                      setEditProjectTypeId(project?.project_type_id || "");
                    }} disabled={isSaving}>
                        <X className="h-4 w-4 mr-1" />
                        {tForms('projects.cancel')}
                      </Button>
                    </div>
                  </div> : 
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <DialogTitle asChild>
                        <div className="space-y-2">
                          {/* Desktop: Name + Badges on same line */}
                          <div className="hidden md:flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl font-bold leading-tight break-words text-left md:text-3xl">{project?.name}</h1>
                            
                            {/* Project Status and Type Badges next to name - Desktop only */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <ProjectStatusBadge projectId={project.id} currentStatusId={localStatusId || undefined} onStatusChange={() => {
                              onProjectUpdated();
                            }} editable={!isArchived} className="text-sm" />
                              
                              {projectType && <Badge variant="outline" className="text-xs">
                                  {projectType.name.toUpperCase()}
                                </Badge>}
                            </div>
                          </div>
                          
                          {/* Mobile: Name only */}
                          <div className="md:hidden">
                            <h1 className="text-xl font-bold leading-tight break-words text-left">{project?.name}</h1>
                          </div>
                          
                          {/* Project Description - All screens */}
                          {project?.description && <p className="text-muted-foreground text-sm font-normal text-left">{project.description}</p>}
                        </div>
                      </DialogTitle>
                      
                      {/* Mobile Layout: Badges then Assignees */}
                      <div className="md:hidden space-y-4 mt-6">
                        {/* Stage and Type badges for mobile */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <ProjectStatusBadge projectId={project.id} currentStatusId={localStatusId || undefined} onStatusChange={() => {
                          onProjectUpdated();
                        }} editable={!isArchived} className="text-sm" />
                          
                          {projectType && <Badge variant="outline" className="text-xs">
                              {projectType.name.toUpperCase()}
                            </Badge>}
                        </div>
                        
                        {/* Assignees removed - single user organization */}
                        <div className="pt-2">
                        </div>
                      </div>
                      
                      {/* Desktop Assignees removed - single user organization */}
                      <div className="hidden md:flex items-center gap-4 mt-16 pt-4">
                      </div>
                    </div>
                  </div>}
                
              </div>
              
              <div className="flex items-center gap-1 shrink-0 self-start">
                {!isEditing && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label="More actions" className="text-muted-foreground hover:text-foreground h-8 px-2 gap-1 md:h-10 md:px-3">
                        <span className="text-sm hidden md:inline">{tForms("projectDetails.header.more")}</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="bottom" className="z-50 bg-background">
                       <DropdownMenuItem role="menuitem" onSelect={() => setIsEditing(true)}>
                         <Pencil className="mr-2 h-4 w-4" />
                         <span>{tForms("projectDetails.header.edit")}</span>
                       </DropdownMenuItem>
                       <DropdownMenuItem role="menuitem" onSelect={handleArchiveAction}>
                         {isArchived ? <>
                             <ArchiveRestore className="mr-2 h-4 w-4" />
                             <span>{tForms("projectDetails.header.restore")}</span>
                           </> : <>
                             <Archive className="mr-2 h-4 w-4" />
                             <span>{tForms("projectDetails.header.archive")}</span>
                           </>}
                       </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                {/* Hide fullscreen toggle on mobile since it's always fullscreen */}
                <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 md:h-10 md:w-10 hidden md:flex">
                  {isFullscreen ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 0V3m0 6l6-6M15 15v6m0-6H9m6 0l-6 6" />
                    </svg> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>}
                </Button>
                 <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground text-sm h-8 px-2 md:h-10 md:px-3">
                   <span className="hidden md:inline">{tForms("projectDetails.header.close")}</span>
                   <X className="h-4 w-4 md:hidden" />
                 </Button>
              </div>
            </div>
          </DialogHeader>
          
          {isArchived && <div className="mb-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm px-3 py-2">
              {tForms("archivedProject.banner")}
            </div>}

          <div className={isArchived ? 'opacity-60 pointer-events-none select-none' : ''}>
             <ProjectDetailsLayout header={<></>} left={<div className="space-y-4">
                   {project && (
                     <ProjectPackageSummaryCard
                       projectId={project.id}
                       packageId={project.package_id ?? null}
                       snapshot={packageSnapshot}
                       servicesVersion={servicesVersion}
                       onEditDetails={() => openEditWizard("details")}
                       onEditPackage={() => openEditWizard("packages")}
                     />
                   )}
                   {lead && <UnifiedClientDetails 
                     lead={lead} 
                     showClickableNames={true}
                     onLeadUpdated={() => {
                       fetchLead();
                       onProjectUpdated();
                     }} 
                   />}
                 </div>} sections={[{
               id: sectionId.payments,
               title: tForms('projectDetails.sections.payments'),
               content: <ProjectPaymentsSection projectId={project!.id} onPaymentsUpdated={() => {
                 onProjectUpdated();
                 onActivityUpdated?.();
               }} refreshToken={servicesVersion} />
             }, {
               id: sectionId.services,
               title: tForms('projectDetails.sections.services'),
               content: <ProjectServicesSection projectId={project!.id} onServicesUpdated={() => {
                 setServicesVersion(v => v + 1);
                 onProjectUpdated();
                 onActivityUpdated?.();
               }} />
             }, {
               id: sectionId.sessions,
               title: tForms('projectDetails.sections.sessions'),
               content: <SessionsSection sessions={sessions} loading={loading} leadId={project!.lead_id} projectId={project!.id} leadName={leadName} projectName={project!.name} onSessionUpdated={() => {
                 handleSessionUpdated();
                 onActivityUpdated?.();
               }} onDeleteSession={handleDeleteSession} />
             }, {
               id: sectionId.activities,
               title: tForms('projectDetails.sections.activities'),
               content: <ProjectActivitySection projectId={project!.id} leadId={project!.lead_id} leadName={leadName} projectName={project!.name} onActivityUpdated={() => {
                 onActivityUpdated?.();
               }} />
             }, {
               id: sectionId.todos,
               title: tForms('projectDetails.sections.todos'),
               content: <ProjectTodoListEnhanced projectId={project!.id} />
             }]} overviewNavId="project-dialog-overview" overviewLabel={tForms('project_sheet.overview_tab')} stickyTopOffset={dialogNavOffset} onOverviewScroll={() => {
               if (scrollContainerRef.current) {
                 scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
               } else {
                 window.scrollTo({ top: 0, behavior: "smooth" });
               }
             }} scrollContainerRef={scrollContainerRef} rightFooter={<div className="border border-destructive/20 bg-destructive/5 rounded-md p-4">
                   <div className="space-y-3">
                     <Button variant="outline" onClick={() => setShowDeleteDialog(true)} className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                       {tForms('projectDetails.header.delete')}
                     </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        {tForms('projectDetails.dangerZone.description')}
                      </p>
                   </div>
                 </div>} />
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForms('viewProject.deleteProject')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tForms('projectDetails.dangerZone.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tForms('projectDetails.dangerZone.confirmCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? tForms('viewProject.deleting') : tForms('projectDetails.dangerZone.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {project ? (
        <ProjectCreationWizardSheet
          isOpen={editWizardOpen}
          onOpenChange={setEditWizardOpen}
          leadId={project.lead_id}
          leadName={lead?.name ?? leadName}
          projectId={project.id}
          startStepOverride={editWizardStartStep}
          mode="edit"
          onProjectUpdated={handleWizardUpdated}
        />
      ) : null}

    </>;
}
