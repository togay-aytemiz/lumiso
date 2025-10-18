import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Save, X, ChevronDown, Pencil, Archive, ArchiveRestore, ExternalLink } from "lucide-react";
import { format } from "date-fns";
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
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  const handleArchiveAction = async () => {
    if (!project) return;
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
    } catch (e: any) {
      toast({
        title: tMessages('error.actionFailed'),
        description: e.message || tMessages('error.archiveUpdateFailed'),
        variant: 'destructive'
      });
    }
  };

  if (!project) return null;

  // Header content - same as original modal
  const headerContent = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0 space-y-3">
        {isEditing ? (
          <div className="space-y-3 text-2xl font-bold text-left">
            <Input 
              value={editName} 
              onChange={e => setEditName(e.target.value)} 
              placeholder={tForms('labels.project_name')} 
              className="text-2xl font-bold border rounded-md px-3 py-2" 
            />
            <Textarea 
              value={editDescription} 
              onChange={e => setEditDescription(e.target.value)} 
              placeholder={tForms('labels.project_description')} 
              className="text-base border rounded-md px-3 py-2 resize-none" 
              rows={2} 
            />
            <SimpleProjectTypeSelect 
              value={editProjectTypeId} 
              onValueChange={setEditProjectTypeId} 
              disabled={isSaving} 
              required 
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleSaveProject} 
                disabled={isSaving || !editName.trim() || !editProjectTypeId}
              >
                <Save className="h-4 w-4 mr-1" />
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
              >
                <X className="h-4 w-4 mr-1" />
                {tForms('common:buttons.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="space-y-2">
                {/* Desktop: Name + Badges on same line */}
                <div className="hidden md:flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words text-left">
                    {project?.name}
                  </h1>
                  
                  {/* Project Status and Type Badges next to name - Desktop only */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <ProjectStatusBadge 
                      projectId={project.id} 
                      currentStatusId={localStatusId || undefined} 
                      onStatusChange={() => {
                        onProjectUpdated();
                      }} 
                      editable={!isArchived} 
                      className="text-sm" 
                    />
                    
                    {projectType && (
                      <Badge variant="outline" className="text-xs">
                        {projectType.name.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Mobile: Name only */}
                <div className="md:hidden">
                  <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words text-left">
                    {project?.name}
                  </h1>
                </div>
                
                {/* Project Description - All screens */}
                {project?.description && (
                  <p className="text-muted-foreground text-sm font-normal text-left">
                    {project.description}
                  </p>
                )}
              </div>
              
              {/* Mobile Layout: Badges then Assignees */}
              <div className="md:hidden space-y-4 mt-6">
                {/* Stage and Type badges for mobile */}
                <div className="flex items-center gap-2 flex-wrap">
                  <ProjectStatusBadge 
                    projectId={project.id} 
                    currentStatusId={localStatusId || undefined} 
                    onStatusChange={() => {
                      onProjectUpdated();
                    }} 
                    editable={!isArchived} 
                    className="text-sm" 
                  />
                  
                  {projectType && (
                    <Badge variant="outline" className="text-xs">
                      {projectType.name.toUpperCase()}
                    </Badge>
                  )}
                </div>
                
                {/* Assignees List for mobile */}
                {/* Assignees removed - single user organization */}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 shrink-0 self-start">
        {/* Desktop Assignees - moved here to be left of buttons */}
        {/* Assignees removed - single user organization */}
        
        {mode === 'sheet' && onViewFullDetails && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewFullDetails}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 px-2 gap-1 md:h-10 md:px-3"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="text-sm hidden md:inline">{tForms('project_sheet.full_details')}</span>
          </Button>
        )}
        
        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 px-2 gap-1 md:h-10 md:px-3"
              >
                <span className="text-sm hidden md:inline">{tForms('project_sheet.more')}</span>
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
        )}
        
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onOpenChange(false)} 
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground text-sm h-8 px-2 md:h-10 md:px-3"
        >
          <span className="hidden md:inline">{tForms('project_sheet.close')}</span>
          <X className="h-4 w-4 md:hidden" />
        </Button>
      </div>
    </div>
  );

  // Main content sections - exactly the same as original modal
  const mainContent = (
    <>
      {isArchived && (
        <div className="mb-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm px-3 py-2">
          {tForms('project_sheet.archived_banner')}
        </div>
      )}

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
              id: 'payments',
              title: tForms('project_sheet.payments_tab'),
              content: (
                <ProjectPaymentsSection 
                  projectId={project!.id} 
                  onPaymentsUpdated={() => {
                    onProjectUpdated();
                    onActivityUpdated?.();
                  }} 
                  refreshToken={servicesVersion} 
                />
              )
            }, 
            {
              id: 'services',
              title: tForms('project_sheet.services_tab'),
              content: (
                <ProjectServicesSection 
                  projectId={project!.id} 
                  onServicesUpdated={() => {
                    setServicesVersion(v => v + 1);
                    onProjectUpdated();
                    onActivityUpdated?.();
                  }} 
                />
              )
            }, 
            {
              id: 'sessions',
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
              id: 'activities',
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
              id: 'todos',
              title: tForms('project_sheet.todos_tab'),
              content: <ProjectTodoListEnhanced projectId={project!.id} />
            }
          ]} 
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
        <Sheet open={open} onOpenChange={handleDialogOpenChange}>
          <SheetContent 
            side={isMobile ? "bottom" : "right"}
            className={`${isFullscreen ? 'max-w-none w-[100vw] h-[100vh] m-0 rounded-none overflow-y-auto' : isMobile ? 'h-[100vh] max-w-none w-full' : 'sm:max-w-5xl h-[100vh] overflow-y-auto'} overscroll-contain pr-2 pt-8 sm:pt-6`}
          >
            <div className="max-w-full overflow-x-hidden">
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
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-none w-[100vw] h-[100vh] m-0 rounded-none overflow-y-auto overscroll-contain pr-2 [&>button]:hidden pt-8 sm:pt-6">
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
