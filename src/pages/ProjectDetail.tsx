import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, X, ChevronDown, Pencil, Archive, ArchiveRestore, FolderOpen, CalendarPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectActivitySection } from "@/components/ProjectActivitySection";
import { ProjectTodoListEnhanced } from "@/components/ProjectTodoListEnhanced";
import { ProjectServicesSection } from "@/components/ProjectServicesSection";
import { SessionsSection } from "@/components/SessionsSection";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { SimpleProjectTypeSelect } from "@/components/SimpleProjectTypeSelect";
import { ProjectPaymentsSection } from "@/components/ProjectPaymentsSection";
import { ProjectPackageSummaryCard } from "@/components/ProjectPackageSummaryCard";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import { SessionSchedulingSheet } from "@/components/SessionSchedulingSheet";
// AssigneesList removed - single user organization
import { SessionWithStatus } from "@/lib/sessionSorting";
import { onArchiveToggle } from "@/components/projectArchiveToggle";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { EntityHeader } from "@/components/EntityHeader";
import { buildProjectSummaryItems } from "@/lib/projects/buildProjectSummaryItems";
import { useProjectHeaderSummary } from "@/hooks/useProjectHeaderSummary";
import { useProjectSessionsSummary } from "@/hooks/useProjectSessionsSummary";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  parseProjectPackageSnapshot,
  type ProjectPackageSnapshot,
} from "@/lib/projects/projectPackageSnapshot";
import { ProjectCreationWizardSheet } from "@/features/project-creation";
import type { ProjectCreationStepId } from "@/features/project-creation/types";
import { BaseOnboardingModal } from "@/components/shared/BaseOnboardingModal";
import { TutorialFloatingCard } from "@/components/shared/TutorialFloatingCard";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useOnboarding } from "@/contexts/OnboardingContext";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

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

interface Session extends SessionWithStatus {
  session_time: string;
  notes: string;
}

type ProjectRow = Project;
type LeadRow = Lead;
type ProjectTypeRow = ProjectType;
type SessionRow = SessionWithStatus & {
  session_time: string | null;
  notes: string | null;
};

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
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const { completeCurrentStep, completeMultipleSteps, isInGuidedSetup, currentStep } = useOnboarding();

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
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiveConfirmState, setArchiveConfirmState] = useState({
    hasOutstanding: false,
    outstandingAmount: 0,
    plannedCount: 0
  });
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [editWizardOpen, setEditWizardOpen] = useState(false);
  const [editWizardStartStep, setEditWizardStartStep] =
    useState<ProjectCreationStepId>("details");
  const [showProjectOnboardingModal, setShowProjectOnboardingModal] = useState(false);
  const [hasSeenProjectOnboardingModal, setHasSeenProjectOnboardingModal] = useState(false);
  const [showProjectExploreCard, setShowProjectExploreCard] = useState(false);
  const [showProjectCompletionModal, setShowProjectCompletionModal] = useState(false);
  const projectDetailsVideoUrl =
    (import.meta.env.VITE_PROJECT_DETAILS_TUTORIAL_VIDEO_URL as string | undefined) || "";
  const hasProjectDetailsVideo = projectDetailsVideoUrl.length > 0;
  const onboardingFlag = searchParams.get("onboarding");
  const explorePoints = useMemo(
    () =>
      (tPages("leadDetail.tutorial.exploreProjects.points", {
        returnObjects: true,
      }) as string[]) ?? [],
    [tPages]
  );

  const { summary: headerSummary } = useProjectHeaderSummary(project?.id, summaryRefreshToken);
  const { summary: sessionsSummary } = useProjectSessionsSummary(project?.id ?? "", summaryRefreshToken);
  const packageSnapshot = useMemo(
    () => parseProjectPackageSnapshot(project?.package_snapshot),
    [project?.package_snapshot]
  );

  const plannedSessionsCount = useMemo(() => {
    return sessions.filter(session => (session.status || "").toLowerCase() === "planned").length;
  }, [sessions]);

  const formatArchiveAmount = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: headerSummary.payments.currency || "TRY",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${Math.round(amount)} ${headerSummary.payments.currency || "TRY"}`;
    }
  };

  const fetchProject = useCallback(async (): Promise<Project | null> => {
    if (!id) return null;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      const projectRow = (data as ProjectRow) ?? null;
      if (!projectRow) {
        throw new Error('Project not found');
      }

      setProject(projectRow);
      setEditName(projectRow.name);
      setEditDescription(projectRow.description || "");
      setEditProjectTypeId(projectRow.project_type_id || "");
      return projectRow;
    } catch (error: unknown) {
      console.error('Error fetching project:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive"
      });
      navigate('/projects');
      return null;
    }
  }, [id, navigate, toast]);

  const fetchProjectSessions = useCallback(async () => {
    if (!project) return;
    setSessionLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('project_id', project.id);
      
      if (error) throw error;
      const sessionRows = (data ?? []) as SessionRow[];
      const mappedSessions: Session[] = sessionRows.map((row) => ({
        ...row,
        session_time: row.session_time ?? '',
        notes: row.notes ?? '',
      }));
      setSessions(mappedSessions);
    } catch (error: unknown) {
      console.error('Error fetching project sessions:', error);
      toast({
        title: "Error loading sessions",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setSessionLoading(false);
    }
  }, [project, toast]);

  const fetchLead = useCallback(async () => {
    if (!project?.lead_id) return;
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, status, notes')
        .eq('id', project.lead_id)
        .single();

      if (error) throw error;
      setLead((data as LeadRow) ?? null);
    } catch (error: unknown) {
      console.error('Error fetching lead:', error);
    }
  }, [project?.lead_id]);

  const fetchProjectType = useCallback(async () => {
    if (!project?.project_type_id) return;
    
    try {
      const { data, error } = await supabase
        .from('project_types')
        .select('id, name')
        .eq('id', project.project_type_id)
        .single();

      if (error) throw error;
      setProjectType((data as ProjectTypeRow) ?? null);
    } catch (error: unknown) {
      console.error('Error fetching project type:', error);
    }
  }, [project?.project_type_id]);

  const checkArchiveStatus = useCallback(async (targetProject?: Project | null) => {
    const source = targetProject ?? project;
    if (!source?.id) {
      setIsArchived(false);
      setLocalStatusId(null);
      return;
    }

    try {
      let archived = false;
      if (source.status_id) {
        const { data: statusData } = await supabase
          .from('project_statuses')
          .select('id, name')
          .eq('id', source.status_id)
          .maybeSingle();

        archived = Boolean(statusData?.name && statusData.name.toLowerCase() === 'archived');
      }

      setIsArchived(archived);

      const { data: projRow } = await supabase
        .from('projects')
        .select('status_id, previous_status_id')
        .eq('id', source.id)
        .single();

      if (archived) {
        setLocalStatusId(projRow?.previous_status_id || null);
      } else {
        setLocalStatusId(projRow?.status_id || null);
      }
    } catch {
      setIsArchived(prev => prev);
      setLocalStatusId(source?.status_id || null);
    }
  }, [project]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (hasSeenProjectOnboardingModal || onboardingFlag !== "project-details") {
      return;
    }

    setShowProjectOnboardingModal(true);
    setShowProjectExploreCard(true);
    setHasSeenProjectOnboardingModal(true);

    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("onboarding");
        window.history.replaceState({}, "", url.toString());
      } catch (error) {
        console.warn("Unable to remove onboarding param from URL", error);
      }
    }
  }, [hasSeenProjectOnboardingModal, onboardingFlag]);

  useEffect(() => {
    if (project) {
      fetchLead();
      fetchProjectType();
      checkArchiveStatus();
      fetchProjectSessions();
      setLoading(false);
    }
  }, [project, fetchLead, fetchProjectType, checkArchiveStatus, fetchProjectSessions]);

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
        } catch (typeError: unknown) {
          console.error('Error fetching updated project type:', typeError);
        }
      }

      setIsEditing(false);
      await fetchProject();
    } catch (error: unknown) {
      toast({
        title: "Error updating project",
        description: getErrorMessage(error),
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
    } catch (error: unknown) {
      toast({
        title: "Error deleting project",
        description: getErrorMessage(error),
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
    } catch (error: unknown) {
      toast({
        title: "Error deleting session",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };

  const executeArchiveToggle = async () => {
    if (!project) return;

    setArchiveLoading(true);
    try {
      const result = await onArchiveToggle(project);
      setIsArchived(result.isArchived);

      toast({
        title: "Success",
        description: result.isArchived ? "Project archived successfully." : "Project restored successfully."
      });

      const updatedProject = await fetchProject();
      await checkArchiveStatus(updatedProject);
      setArchiveConfirmOpen(false);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleArchiveAction = () => {
    if (!project) return;

    if (isArchived) {
      executeArchiveToggle();
      return;
    }

    const outstandingAmount = headerSummary.payments.remaining || 0;
    const hasOutstanding = outstandingAmount > 0;
    const plannedCount = plannedSessionsCount;

    if (!hasOutstanding && plannedCount === 0) {
      executeArchiveToggle();
      return;
    }

    setArchiveConfirmState({
      hasOutstanding,
      outstandingAmount,
      plannedCount
    });
    setArchiveConfirmOpen(true);
  };

  const handleAssigneesUpdate = async () => {
    const updatedProject = await fetchProject();
    await checkArchiveStatus(updatedProject);
  };

  const handleStatusChange = async () => {
    const updatedProject = await fetchProject();
    await checkArchiveStatus(updatedProject);
  };

  const triggerSummaryRefresh = useCallback(() => {
    setSummaryRefreshToken((prev) => prev + 1);
  }, []);

  const handleExploreNext = useCallback(() => {
    setShowProjectExploreCard(false);
    setShowProjectCompletionModal(true);
  }, []);

  const handleExploreExit = useCallback(() => {
    setShowProjectExploreCard(false);
  }, []);

  const handleProjectCompletion = useCallback(async () => {
    try {
      if (isInGuidedSetup) {
        // Advance enough steps so the user lands on the Projects exploration step (step 4)
        const stepsToComplete = Math.max(1, 4 - currentStep);
        if (stepsToComplete > 1) {
          await completeMultipleSteps(stepsToComplete);
        } else {
          await completeCurrentStep();
        }
      }
      navigate("/getting-started");
    } catch (error) {
      console.error("Error completing project onboarding step:", error);
    } finally {
      setShowProjectCompletionModal(false);
    }
  }, [completeCurrentStep, completeMultipleSteps, currentStep, isInGuidedSetup, navigate]);

  const openEditWizard = useCallback((step: ProjectCreationStepId) => {
    setEditWizardStartStep(step);
    setEditWizardOpen(true);
  }, []);

  const handleWizardUpdated = useCallback(() => {
    void fetchProject();
    triggerSummaryRefresh();
    setServicesVersion(prev => prev + 1);
  }, [fetchProject, triggerSummaryRefresh]);

  const handleStatusPreview = useCallback((statusId: string | null) => {
    setLocalStatusId(statusId);
  }, []);

  const summaryItems = useMemo(
    () => buildProjectSummaryItems({
      t: tPages,
      payments: headerSummary.payments,
      todos: headerSummary.todos,
      services: headerSummary.services,
      sessionsSummary
    }),
    [headerSummary, sessionsSummary, tPages]
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
  const headerTitle = (
    <span className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {projectTypeLabel}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-foreground">
        <span className="break-words text-pretty leading-tight">{projectNameDisplay}</span>
        {!isMobile && !isEditing && (
          <ProjectStatusBadge
            projectId={project.id}
            currentStatusId={localStatusId || undefined}
            onStatusChange={handleStatusChange}
            onStatusSelecting={handleStatusPreview}
            editable={!isArchived}
            size="sm"
            className="h-8"
          />
        )}
      </span>
    </span>
  );

  const headerSubtext = !isEditing && project.description ? project.description : undefined;

  const archivedBanner = isArchived
    ? (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100">
          <Archive className="mt-0.5 h-4 w-4 text-sky-500 dark:text-sky-300" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-sky-900 dark:text-sky-50">
              {t("project_sheet.archived_banner_title")}
            </p>
            <p>{t("project_sheet.archived_banner_description")}</p>
          </div>
        </div>
      )
    : undefined;

  const moreActionsButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[120px] justify-center gap-2">
          <span>{t("project_sheet.more")}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem onSelect={() => setSessionSheetOpen(true)}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          <span>{t("sessions.schedule_new")}</span>
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

  const desktopQuickActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="min-w-[140px] gap-2 border-indigo-500 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 hover:text-indigo-900"
        onClick={() => setSessionSheetOpen(true)}
      >
        <CalendarPlus className="h-4 w-4" />
        {t("sessions.schedule_new")}
      </Button>
      <Button
        variant="pill"
        size="sm"
        className="min-w-[140px]"
        onClick={handleArchiveAction}
      >
        {isArchived ? t("project_sheet.restore_project") : t("project_sheet.archive_project")}
      </Button>
    </div>
  );

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
    isMobile ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[160px]">
          <ProjectStatusBadge
            projectId={project.id}
            currentStatusId={localStatusId || undefined}
            onStatusChange={handleStatusChange}
            onStatusSelecting={handleStatusPreview}
            editable={!isArchived}
            size="sm"
            className="w-full justify-center"
          />
        </div>
        {moreActionsButton}
      </div>
    ) : (
      desktopQuickActions
    )
  );

  const headerBanner = archivedBanner;

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
          banner={headerBanner}
          summaryItems={isEditing ? undefined : summaryItems}
          avatarClassName="bg-gradient-to-br from-indigo-300 via-indigo-400 to-indigo-600 text-white ring-0"
          avatarContent={<FolderOpen className="h-5 w-5" />}
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

      {/* Main Content - same layout but optimized for full page */}
      <div className={isArchived ? 'opacity-60 pointer-events-none select-none' : ''}>
        <ProjectDetailsLayout 
          header={<></>} 
          left={
            <div className="space-y-6">
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
              {lead && (
                <UnifiedClientDetails 
                  lead={lead} 
                  showClickableNames={true}
                  defaultExpanded={!isMobile}
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
                  onBasePriceUpdated={() => {
                    setServicesVersion(v => v + 1);
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
                  refreshToken={servicesVersion}
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
          overviewNavId="project-detail-overview"
          overviewLabel={t('project_sheet.overview_tab')}
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

      {showProjectExploreCard && (isInGuidedSetup || onboardingFlag === "project-details") && (
        <TutorialFloatingCard
          stepNumber={4}
          totalSteps={5}
          title={tPages("leadDetail.tutorial.exploreProjects.title")}
          description={tPages("leadDetail.tutorial.exploreProjects.description")}
          content={
            <div className="space-y-2">
              {explorePoints.map((point) => (
                <div key={point} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          }
          canProceed
          onNext={handleExploreNext}
          onExit={handleExploreExit}
          position="bottom-right"
        />
      )}

      <BaseOnboardingModal
        open={showProjectCompletionModal}
        onClose={() => setShowProjectCompletionModal(false)}
        eyebrow={tPages("onboarding.tutorial.step_of", { current: 5, total: 5 })}
        title={tPages("leadDetail.tutorial.complete.title")}
        description={tPages("leadDetail.tutorial.complete.description")}
        actions={[
          {
            label: tPages("onboarding.tutorial.exit_tutorial"),
            onClick: () => setShowProjectCompletionModal(false),
            variant: "outline",
          },
          {
            label: tPages("onboarding.tutorial.continue_setup"),
            onClick: handleProjectCompletion,
            variant: "default",
          },
        ]}
      >
        <div className="p-3 bg-primary/5 border border-primary/30 rounded-lg">
          <p className="text-sm font-medium text-primary">
            {tPages("leadDetail.tutorial.complete.projectsShortcut")}
          </p>
        </div>
      </BaseOnboardingModal>

      <BaseOnboardingModal
        open={showProjectOnboardingModal}
        onClose={() => setShowProjectOnboardingModal(false)}
        title={tPages("projectDetail.onboardingModal.title")}
        description={tPages("projectDetail.onboardingModal.description")}
        actions={[
          {
            label: tPages("projectDetail.onboardingModal.skip"),
            onClick: () => setShowProjectOnboardingModal(false),
            variant: "outline"
          },
          {
            label: tPages("projectDetail.onboardingModal.cta"),
            onClick: () => setShowProjectOnboardingModal(false),
            variant: "default"
          }
        ]}
      >
        <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg bg-muted">
          {hasProjectDetailsVideo ? (
            <iframe
              src={projectDetailsVideoUrl}
              title={tPages("projectDetail.onboardingModal.title")}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {tPages("projectDetail.onboardingModal.placeholder")}
            </div>
          )}
        </AspectRatio>
      </BaseOnboardingModal>

      <AlertDialog
        open={archiveConfirmOpen}
        onOpenChange={open => {
          if (!archiveLoading) {
            setArchiveConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tPages('projectDetail.archiveConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>{tPages('projectDetail.archiveConfirm.description')}</p>
                {archiveConfirmState.hasOutstanding && (
                  <p>{tPages('projectDetail.archiveConfirm.outstanding', {
                    amount: formatArchiveAmount(archiveConfirmState.outstandingAmount)
                  })}</p>
                )}
                {archiveConfirmState.plannedCount > 0 && (
                  <p>{tPages('projectDetail.archiveConfirm.plannedSessions', {
                    count: archiveConfirmState.plannedCount
                  })}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveLoading}>
              {tPages('projectDetail.archiveConfirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={executeArchiveToggle} disabled={archiveLoading}>
              {archiveLoading
                ? tPages('projectDetail.archiveConfirm.confirmLoading')
                : tPages('projectDetail.archiveConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {project ? (
        <ProjectCreationWizardSheet
          isOpen={editWizardOpen}
          onOpenChange={setEditWizardOpen}
          leadId={project.lead_id}
          leadName={lead?.name ?? ""}
          projectId={project.id}
          startStepOverride={editWizardStartStep}
          mode="edit"
          onProjectUpdated={handleWizardUpdated}
        />
      ) : null}
      {project ? (
        <SessionSchedulingSheet
          leadId={project.lead_id}
          leadName={lead?.name ?? ""}
          projectId={project.id}
          projectName={project.name}
          isOpen={sessionSheetOpen}
          onOpenChange={setSessionSheetOpen}
          onSessionScheduled={() => {
            handleSessionUpdated();
            triggerSummaryRefresh();
          }}
        />
      ) : null}
    </div>
  );
}
