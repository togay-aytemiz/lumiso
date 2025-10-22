import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, X, ChevronDown, Pencil, Archive, ArchiveRestore, ExternalLink, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectActivitySection } from "./ProjectActivitySection";
import { ProjectTodoListEnhanced } from "./ProjectTodoListEnhanced";
import { ProjectServicesSection } from "./ProjectServicesSection";
import { SessionsSection } from "./SessionsSection";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { SimpleProjectTypeSelect } from "./SimpleProjectTypeSelect";
import { ProjectPaymentsSection } from "./ProjectPaymentsSection";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
// AssigneesList removed - single user organization
import { SessionWithStatus } from "@/lib/sessionSorting";
import { onArchiveToggle } from "@/components/ViewProjectDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { EntityHeader } from "@/components/EntityHeader";
import { buildProjectSummaryItems } from "@/lib/projects/buildProjectSummaryItems";
import { useProjectHeaderSummary } from "@/hooks/useProjectHeaderSummary";
import { useProjectSessionsSummary } from "@/hooks/useProjectSessionsSummary";

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

interface ProjectSheetViewProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectUpdated: () => void;
  onActivityUpdated?: () => void;
  leadName: string;
  mode?: 'sheet' | 'fullscreen'; // New prop to control display mode
  onViewFullDetails?: () => void; // Callback to switch to full page
}

export function ProjectSheetView({
  project,
  open,
  onOpenChange,
  onProjectUpdated,
  onActivityUpdated,
  leadName,
  mode = 'sheet',
  onViewFullDetails
}: ProjectSheetViewProps) {
  const { t: tForms } = useFormsTranslation();
  const { t: tMessages } = useMessagesTranslation();
  const { t: tPages } = useTranslation("pages");
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
  const [localStatusId, setLocalStatusId] = useState<string | null | undefined>(null);
  const [summaryRefreshToken, setSummaryRefreshToken] = useState(0);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiveConfirmState, setArchiveConfirmState] = useState({
    hasOutstanding: false,
    outstandingAmount: 0,
    plannedCount: 0
  });
  const [archiveLoading, setArchiveLoading] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { summary: headerSummary } = useProjectHeaderSummary(project?.id || null, summaryRefreshToken);
  const { summary: sessionsSummary } = useProjectSessionsSummary(project?.id ?? "", summaryRefreshToken);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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

  const fetchProjectSessions = async () => {
    if (!project) return;
    setLoading(true);
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
      setLoading(false);
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

  const handleAssigneesUpdate = () => {
    onProjectUpdated();
  };

  useEffect(() => {
    if (project && open) {
      fetchProjectSessions();
      fetchProjectType();
      fetchLead();
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditProjectTypeId(project.project_type_id || "");
      setIsEditing(false);

      // For sheet mode, determine fullscreen behavior
      if (mode === 'sheet') {
        setIsFullscreen(isMobile);
      } else {
        setIsFullscreen(true);
      }
      
      setLocalStatusId(project.status_id || null);
    }
  }, [project, open, mode, isMobile]);

  useEffect(() => {
    const fetchStatus = async () => {
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
    fetchStatus();
  }, [project?.id, project?.status_id, open]);

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && isFullscreen && mode === 'sheet') {
      const isMobileCheck = window.innerWidth <= 768;
      if (isMobileCheck) {
        onOpenChange(newOpen);
        return;
      }
      setIsFullscreen(false);
      return;
    }

    onOpenChange(newOpen);
  };

  const toggleFullscreen = () => {
    if (mode === 'sheet') {
      const isMobileCheck = window.innerWidth <= 768;
      if (!isMobileCheck) {
        setIsFullscreen(!isFullscreen);
      }
    }
  };

  const handleSaveProject = async () => {
    if (!project || !editName.trim() || !editProjectTypeId) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(tMessages('info.userNotAuthenticated'));

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
        description: tMessages('success.projectUpdated')
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
        description: tMessages('success.projectDeleted')
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
    onProjectUpdated();
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
        description: tMessages('success.sessionDeleted')
      });
      
      fetchProjectSessions();
      onProjectUpdated();
    } catch (error: any) {
      toast({
        title: tMessages('error.deletingSession'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const executeArchiveToggle = async () => {
    if (!project) return;
    setArchiveLoading(true);
    try {
      const res = await onArchiveToggle({
        id: project.id,
        status_id: project.status_id
      });
      setIsArchived(res.isArchived);

      const { data: projRow } = await supabase
        .from('projects')
        .select('status_id, previous_status_id')
        .eq('id', project.id)
        .single();

      setLocalStatusId(res.isArchived ? projRow?.previous_status_id || null : projRow?.status_id || null);
      onProjectUpdated();
      onActivityUpdated?.();
      setArchiveConfirmOpen(false);
    } catch (e: any) {
      toast({
        title: tMessages('error.actionFailed'),
        description: e.message || tMessages('error.archiveUpdateFailed'),
        variant: 'destructive'
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

  const triggerSummaryRefresh = () => {
    setSummaryRefreshToken(prev => prev + 1);
  };

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

  if (!project) return null;

  const archiveConfirmDialog = (
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
  );

  const projectTypeLabel = projectType?.name || tPages('projectDetail.header.defaultType');
  const projectNameDisplay = project?.name || tPages('projectDetail.placeholders.name');
  const statusBadgeNode = (
    <ProjectStatusBadge
      projectId={project.id}
      currentStatusId={localStatusId || undefined}
      onStatusChange={() => {
        onProjectUpdated();
      }}
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

  const archivedBanner = isArchived
    ? (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100">
          <Archive className="mt-0.5 h-4 w-4 text-sky-500 dark:text-sky-300" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-sky-900 dark:text-sky-50">
              {tForms("project_sheet.archived_banner_title")}
            </p>
            <p>{tForms("project_sheet.archived_banner_description")}</p>
          </div>
        </div>
      )
    : undefined;

  const headerActions = isEditing ? (
    <>
      <Button
        size="sm"
        onClick={handleSaveProject}
        disabled={isSaving || !editName.trim() || !editProjectTypeId}
        className="gap-2"
      >
        <Save className="h-4 w-4" />
        {isSaving ? tForms('common:actions.saving') : tForms('common:buttons.save')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setIsEditing(false);
          setEditName(project?.name || "");
          setEditDescription(project?.description || "");
          setEditProjectTypeId(project?.project_type_id || "");
        }}
        disabled={isSaving}
        className="gap-2"
      >
        <X className="h-4 w-4" />
        {tForms('common:buttons.cancel')}
      </Button>
    </>
  ) : (
    <>
      {mode === 'sheet' && onViewFullDetails && !isMobile && (
        <Button
          variant="outline"
          size="sm"
          onClick={onViewFullDetails}
          className="w-full justify-center gap-2 text-sm font-medium hover:bg-accent sm:w-auto sm:px-4"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="text-sm">{tForms('project_sheet.full_details')}</span>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:w-auto sm:px-3"
          >
            <span>{tForms('project_sheet.more')}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="z-50 bg-background">
          <DropdownMenuItem role="menuitem" onSelect={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            <span>{tForms('project_sheet.edit_project')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem role="menuitem" onSelect={handleArchiveAction}>
            {isArchived ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                <span>{tForms('project_sheet.restore_project')}</span>
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                <span>{tForms('project_sheet.archive_project')}</span>
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onOpenChange(false)}
        className="hidden sm:inline-flex justify-center text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:w-auto sm:px-3"
      >
        <span>{tForms('project_sheet.close')}</span>
      </Button>
    </>
  );

  const headerContent = (
    <div className="w-full">
      <EntityHeader
        className="mb-4"
        name={project.name || ""}
        title={headerTitle}
        subtext={headerSubtext}
        banner={archivedBanner}
        summaryItems={isEditing ? undefined : summaryItems}
        avatarClassName="bg-gradient-to-br from-indigo-300 via-indigo-400 to-indigo-600 text-white ring-0"
        avatarContent={<FolderOpen className="h-5 w-5" />}
        actions={headerActions}
        fallbackInitials="PR"
      />
      {isEditing && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={tForms('labels.project_name')}
            />
            <Textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder={tForms('labels.project_description')}
              className="min-h-[100px] resize-none"
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
      )}
    </div>
  );

  const sheetNavOffset = isMobile ? 32 : 24;
  const sectionId = {
    payments: "project-sheet-payments",
    services: "project-sheet-services",
    sessions: "project-sheet-sessions",
    activities: "project-sheet-activities",
    todos: "project-sheet-todos"
  } as const;

  // Main content sections - exactly the same as original modal
  const mainContent = (
    <>
      <div className={isArchived ? 'opacity-60 pointer-events-none select-none' : ''}>
        <ProjectDetailsLayout 
          header={<></>} 
          left={
            <div className="space-y-4">
              {lead && (
                <UnifiedClientDetails 
                  lead={lead} 
                  showClickableNames={true}
                  onLeadUpdated={() => {
                    fetchLead();
                    onProjectUpdated();
                  }} 
                />
              )}
            </div>
          } 
          sections={[
            {
              id: sectionId.payments,
              title: tForms('project_sheet.payments_tab'),
              content: (
                <ProjectPaymentsSection
                  projectId={project!.id}
                  onPaymentsUpdated={() => {
                    onProjectUpdated();
                    onActivityUpdated?.();
                    triggerSummaryRefresh();
                  }}
                  refreshToken={servicesVersion}
                />
              )
            },
            {
              id: sectionId.services,
              title: tForms('project_sheet.services_tab'),
              content: (
                <ProjectServicesSection 
                  projectId={project!.id}
                  onServicesUpdated={() => {
                    setServicesVersion(v => v + 1);
                    onProjectUpdated();
                    onActivityUpdated?.();
                    triggerSummaryRefresh();
                  }}
                />
              )
            },
            {
              id: sectionId.sessions,
              title: tForms('project_sheet.sessions_tab'),
              content: (
                <SessionsSection 
                  sessions={sessions} 
                  loading={loading} 
                  leadId={project!.lead_id} 
                  projectId={project!.id} 
                  leadName={leadName} 
                  projectName={project!.name} 
                  onSessionUpdated={() => {
                    handleSessionUpdated();
                    onActivityUpdated?.();
                  }} 
                  onDeleteSession={handleDeleteSession} 
                />
              )
            }, 
            {
              id: sectionId.activities,
              title: tForms('project_sheet.activities_tab'),
              content: (
                <ProjectActivitySection 
                  projectId={project!.id} 
                  leadId={project!.lead_id} 
                  leadName={leadName} 
                  projectName={project!.name} 
                  onActivityUpdated={() => {
                    onActivityUpdated?.();
                  }} 
                />
              )
            }, 
            {
              id: sectionId.todos,
              title: tForms('project_sheet.todos_tab'),
              content: <ProjectTodoListEnhanced projectId={project!.id} onTodosUpdated={triggerSummaryRefresh} />
            }
          ]}
          overviewNavId="project-sheet-overview"
          overviewLabel={tForms('project_sheet.overview_tab')}
          stickyTopOffset={sheetNavOffset}
          onOverviewScroll={() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          rightFooter={
            <div className="border border-destructive/20 bg-destructive/5 rounded-md p-4">
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteDialog(true)} 
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  {tForms('danger_zone.title')}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {tForms('danger_zone.description')}
                </p>
              </div>
            </div>
          } 
        />
      </div>
    </>
  );

  // Render as Sheet or Dialog based on mode
  if (mode === 'sheet') {
    return (
      <>
        {archiveConfirmDialog}
        <Sheet open={open} onOpenChange={handleDialogOpenChange}>
          <SheetContent
            ref={scrollContainerRef}
            side={isMobile ? "bottom" : "right"}
            className={`${isFullscreen ? 'max-w-none w-[100vw] h-[100vh] m-0 rounded-none overflow-y-auto' : isMobile ? 'h-[100vh] max-w-none w-full' : 'sm:max-w-6xl lg:max-w-7xl h-[100vh] overflow-y-auto'} overscroll-contain pr-2 sm:pr-6 pt-8 sm:pt-6`}
          >
            <div className="max-w-full overflow-x-hidden relative">
              {/* Mobile-only top-right close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="sm:hidden absolute top-2 right-2 h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label={tForms('project_sheet.close')}
              >
                <X className="h-4 w-4" />
              </Button>
              <SheetHeader className="pb-4">
                {headerContent}
              </SheetHeader>
              {mainContent}
            </div>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForms('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tForms('deleteDialog.description', { name: project?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tForms('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject} 
              disabled={isDeleting} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? tForms('actions.deleting') : tForms('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Render as fullscreen Dialog
  return (
    <>
      {archiveConfirmDialog}
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          ref={scrollContainerRef}
          className="max-w-none w-[100vw] h-[100vh] m-0 rounded-none overflow-y-auto overscroll-contain pr-2 [&>button]:hidden pt-8 sm:pt-6"
        >
          <div className="max-w-full overflow-x-hidden">
            <DialogHeader className="pb-4">
              <DialogTitle asChild>
                <div>{headerContent}</div>
              </DialogTitle>
            </DialogHeader>
            {mainContent}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForms('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tForms('deleteDialog.description', { name: project?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tForms('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject} 
              disabled={isDeleting} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? tForms('actions.deleting') : tForms('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
