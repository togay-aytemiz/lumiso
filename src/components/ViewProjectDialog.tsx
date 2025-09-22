import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Save, X, ChevronDown, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { format } from "date-fns";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";
import { ProjectActivitySection } from "./ProjectActivitySection";
import { ProjectTodoList } from "./ProjectTodoList";
import { ProjectServicesSection } from "./ProjectServicesSection";
import { SessionsSection } from "./SessionsSection";
import { ProjectTodoListEnhanced } from "./ProjectTodoListEnhanced";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { ProjectTypeSelector } from "./ProjectTypeSelector";
import { ProjectPaymentsSection } from "./ProjectPaymentsSection";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
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
export async function onArchiveToggle(project: {
  id: string;
  status_id?: string | null;
}) {
  // Toggle archive/restore for a project using project_statuses
  const {
    data: userData,
    error: userErr
  } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error('User not authenticated');

  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("Organization required");
  }

  // Find or create Archived status
  let archivedId: string | undefined;
  
  // Check for existing Archived status
  const { data: existingStatuses, error: statusError } = await supabase
    .from('project_statuses')
    .select('id, name')
    .eq('organization_id', organizationId)
    .ilike('name', 'archived');
  
  if (statusError) throw statusError;
  
  // Find existing archived status (case-insensitive)
  const existingArchived = existingStatuses?.find(
    (status: { id: string; name: string }) => 
      status.name.toLowerCase() === 'archived'
  );
  
  if (existingArchived) {
    archivedId = existingArchived.id;
  } else {
    // Create new Archived status if it doesn't exist
    const { data: created, error: createErr } = await supabase
      .from('project_statuses')
      .insert({
        user_id: userData.user.id,
        organization_id: organizationId,
        name: 'Archived',
        color: '#6B7280',
        sort_order: 9999,
        lifecycle: 'cancelled'
      })
      .select('id')
      .single();
    
    if (createErr) {
      // Handle race condition - status might have been created by another user
      if (createErr.code === '23505') { // Unique constraint violation
        const { data: raceStatuses } = await supabase
          .from('project_statuses')
          .select('id')
          .eq('organization_id', organizationId)
          .ilike('name', 'archived')
          .limit(1);
        
        if (raceStatuses && raceStatuses.length > 0) {
          archivedId = raceStatuses[0].id;
        } else {
          throw createErr;
        }
      } else {
        throw createErr;
      }
    } else {
      archivedId = created.id;
    }
  }

  // Load current project to get existing status and previous_status_id
  const {
    data: proj,
    error: projErr
  } = await supabase.from('projects').select('id, status_id, previous_status_id, lead_id').eq('id', project.id).single();
  if (projErr) throw projErr;
  const currentlyArchived = proj.status_id === archivedId;
  if (!currentlyArchived) {
    // Archive: remember previous status and set archived
    const {
      error: updErr
    } = await supabase.from('projects').update({
      previous_status_id: proj.status_id,
      status_id: archivedId
    }).eq('id', project.id).eq('user_id', userData.user.id);
    if (updErr) throw updErr;

    // Log activity
    await supabase.from('activities').insert({
      type: 'status_change',
      content: `Project archived`,
      project_id: project.id,
      lead_id: proj.lead_id,
      user_id: userData.user.id,
      organization_id: organizationId
    });
    // Log to audit history
    await supabase.from('audit_log').insert({
      user_id: userData.user.id,
      entity_type: 'project',
      entity_id: project.id,
      action: 'archived',
      old_values: {
        status_id: proj.status_id
      },
      new_values: {
        status_id: archivedId
      }
    });
    return {
      isArchived: true
    };
  }

  // Restore: get target status (previous or default)
  let targetStatusId: string | null = proj.previous_status_id;
  if (!targetStatusId) {
    const {
      data: def,
      error: defErr
    } = await supabase.rpc('get_default_project_status', {
      user_uuid: userData.user.id
    });
    if (defErr) throw defErr;
    targetStatusId = def as string | null;
  }
  const {
    error: restoreErr
  } = await supabase.from('projects').update({
    status_id: targetStatusId,
    previous_status_id: null
  }).eq('id', project.id).eq('user_id', userData.user.id);
  if (restoreErr) throw restoreErr;
  await supabase.from('activities').insert({
    type: 'status_change',
    content: `Project restored`,
    project_id: project.id,
    lead_id: proj.lead_id,
    user_id: userData.user.id,
    organization_id: organizationId
  });
  // Log to audit history
  await supabase.from('audit_log').insert({
    user_id: userData.user.id,
    entity_type: 'project',
    entity_id: project.id,
    action: 'restored',
    old_values: {
      status_id: archivedId
    },
    new_values: {
      status_id: targetStatusId
    }
  });
  return {
    isArchived: false
  };
}
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
  const [localStatusId, setLocalStatusId] = useState<string | null | undefined>(null);
  const {
    toast
  } = useToast();
  const fetchProjectSessions = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('sessions').select('*').eq('project_id', project.id);
      if (error) throw error;
      setSessions(data as unknown as Session[]);
    } catch (error: any) {
      console.error('Error fetching project sessions:', error);
      toast({
        title: tForms('viewProject.errorLoadingSessions'),
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
      const {
        data,
        error
      } = await supabase.from('project_types').select('id, name').eq('id', project.project_type_id).single();
      if (error) throw error;
      setProjectType(data);
    } catch (error: any) {
      console.error('Error fetching project type:', error);
    }
  };
  const fetchLead = async () => {
    if (!project?.lead_id) return;
    try {
      const {
        data,
        error
      } = await supabase.from('leads').select('id, name, email, phone, status, notes').eq('id', project.lead_id).single();
      if (error) throw error;
      setLead(data);
    } catch (error: any) {
      console.error('Error fetching lead:', error);
    }
  };
  const handleAssigneesUpdate = () => {
    // Force parent to refetch project data to get updated assignees
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

      // Auto-fullscreen on mobile
      const isMobile = window.innerWidth <= 768;
      setIsFullscreen(isMobile);
      setLocalStatusId(project.status_id || null);
    }
  }, [project, open]);
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
        title: "Success",
        description: "Project updated successfully."
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
        } catch (typeError: any) {
          console.error('Error fetching updated project type:', typeError);
        }
      }
      setIsEditing(false);
      onProjectUpdated();
    } catch (error: any) {
      toast({
        title: tForms('viewProject.errorUpdatingProject'),
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

      // Delete sessions
      const {
        error: sessionsError
      } = await supabase.from('sessions').delete().eq('project_id', project.id);
      if (sessionsError) throw sessionsError;

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
        title: "Success",
        description: "Project and all related data deleted successfully."
      });
      onOpenChange(false);
      onProjectUpdated();
    } catch (error: any) {
      toast({
        title: tForms('viewProject.errorDeletingProject'),
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
        title: "Success",
        description: "Session deleted successfully."
      });
      fetchProjectSessions();
      onProjectUpdated(); // Notify parent component to refresh sessions
    } catch (error: any) {
      toast({
        title: tForms('viewProject.errorDeletingSession'),
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

      // Fetch latest status values from DB to avoid stale props
      const {
        data: projRow
      } = await supabase.from('projects').select('status_id, previous_status_id').eq('id', project.id).single();
      setLocalStatusId(res.isArchived ? projRow?.previous_status_id || null : projRow?.status_id || null);
      onProjectUpdated();
    } catch (e: any) {
      toast({
        title: 'Action failed',
        description: e.message || 'Could not update archive state',
        variant: 'destructive'
      });
    }
  };
  if (!project) return null;
  return <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={`${isFullscreen ? 'max-w-none w-[100vw] h-[100vh] m-0 rounded-none overflow-y-auto' : 'sm:max-w-5xl max-h-[85vh] overflow-y-auto'} overscroll-contain pr-2 [&>button]:hidden pt-8 sm:pt-6`}>
          <div className="max-w-full overflow-x-hidden">
          <DialogHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0 space-y-3">
                {isEditing ? <div className="space-y-3 text-2xl font-bold text-left">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder={tForms('projects.projectName')} className="text-2xl font-bold border rounded-md px-3 py-2" />
                      <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Project description (optional)" className="text-base border rounded-md px-3 py-2 resize-none" rows={2} />
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
                        <span className="text-sm hidden md:inline">More</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="bottom" className="z-50 bg-background">
                      <DropdownMenuItem role="menuitem" onSelect={() => setIsEditing(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Edit Project</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem role="menuitem" onSelect={handleArchiveAction}>
                        {isArchived ? <>
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            <span>Restore Project</span>
                          </> : <>
                            <Archive className="mr-2 h-4 w-4" />
                            <span>Archive Project</span>
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
                  <span className="hidden md:inline">{tForms('projects.close')}</span>
                  <X className="h-4 w-4 md:hidden" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {isArchived && <div className="mb-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm px-3 py-2">
              This project is archived. Most actions are disabled. While archived, its sessions and reminders are hidden from calendars, the Sessions page, and activity lists. Use More → Restore to re-enable editing and visibility.
            </div>}

          <div className={isArchived ? 'opacity-60 pointer-events-none select-none' : ''}>
            <ProjectDetailsLayout header={<></>} left={<div className="space-y-4">
                  {lead && <UnifiedClientDetails 
                    lead={lead} 
                    showClickableNames={true}
                    onLeadUpdated={() => {
                      fetchLead();
                      onProjectUpdated();
                    }} 
                  />}
                </div>} sections={[{
              id: 'payments',
              title: 'Payments',
              content: <ProjectPaymentsSection projectId={project!.id} onPaymentsUpdated={() => {
                onProjectUpdated();
                onActivityUpdated?.();
              }} refreshToken={servicesVersion} />
            }, {
              id: 'services',
              title: 'Services',
              content: <ProjectServicesSection projectId={project!.id} onServicesUpdated={() => {
                setServicesVersion(v => v + 1);
                onProjectUpdated();
                onActivityUpdated?.();
              }} />
            }, {
              id: 'sessions',
              title: 'Sessions',
              content: <SessionsSection sessions={sessions} loading={loading} leadId={project!.lead_id} projectId={project!.id} leadName={leadName} projectName={project!.name} onSessionUpdated={() => {
                handleSessionUpdated();
                onActivityUpdated?.();
              }} onDeleteSession={handleDeleteSession} />
            }, {
              id: 'activities',
              title: 'Activities',
              content: <ProjectActivitySection projectId={project!.id} leadId={project!.lead_id} leadName={leadName} projectName={project!.name} onActivityUpdated={() => {
                onActivityUpdated?.();
              }} />
            }, {
              id: 'todos',
              title: 'Todos',
              content: <ProjectTodoListEnhanced projectId={project!.id} />
            }]} rightFooter={<div className="border border-destructive/20 bg-destructive/5 rounded-md p-4">
                  <div className="space-y-3">
                    <Button variant="outline" onClick={() => setShowDeleteDialog(true)} className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                      Delete Project
                    </Button>
                     <p className="text-xs text-muted-foreground text-center">
                       This will permanently delete the project and ALL related data: sessions, payments, todos, services, and activities.
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
              Are you sure you want to delete "{project?.name}"? This action cannot be undone.
              This will permanently delete the project and ALL related data including sessions, payments, todos, services, and activities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? tForms('viewProject.deleting') : tForms('viewProject.deleteProject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>;
}