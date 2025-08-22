import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, X, Pencil, Archive, ArchiveRestore, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectActivitySection } from "@/components/ProjectActivitySection";
import { ProjectTodoListEnhanced } from "@/components/ProjectTodoListEnhanced";
import { ProjectServicesSection } from "@/components/ProjectServicesSection";
import { SessionsSection } from "@/components/SessionsSection";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { ProjectTypeSelector } from "@/components/ProjectTypeSelector";
import { ProjectPaymentsSection } from "@/components/ProjectPaymentsSection";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import { AssigneesList } from "@/components/AssigneesList";
import ProjectSummaryCard from "@/components/project-details/Summary/ProjectSummaryCard";
import { onArchiveToggle } from "@/components/ViewProjectDialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

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

interface ProjectType {
  id: string;
  name: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectTypeId, setEditProjectTypeId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [localStatusId, setLocalStatusId] = useState<string | null | undefined>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      setRefreshTrigger(prev => prev + 1);
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
      setRefreshTrigger(prev => prev + 1);
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
    setRefreshTrigger(prev => prev + 1);
  };

  const handleActivityUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleStatusChange = () => {
    fetchProject();
    checkArchiveStatus();
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Header content
  const headerContent = (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projects')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        {!isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleArchiveAction}>
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Restore Project
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive Project
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Button
              onClick={handleSaveProject}
              disabled={isSaving || !editName.trim() || !editProjectTypeId}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setEditName(project.name);
                setEditDescription(project.description || "");
                setEditProjectTypeId(project.project_type_id || "");
              }}
              size="sm"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );

  // Left sidebar content
  const leftContent = (
    <div className="space-y-4">
      <ProjectSummaryCard
        projectId={project.id}
        name={isEditing ? editName : project.name}
        projectTypeName={projectType?.name}
        statusId={localStatusId}
        onStatusChange={handleStatusChange}
      />
      
      {lead && (
        <UnifiedClientDetails
          lead={lead}
          showQuickActions={true}
        />
      )}
      
      <AssigneesList
        assignees={project.assignees || []}
        entityType="project"
        entityId={project.id}
        onUpdate={handleAssigneesUpdate}
      />
    </div>
  );

  // Main content sections
  const sections = [
    {
      id: "details",
      title: "Project Details",
      content: isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Project Name</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Enter project description"
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Project Type</label>
            <ProjectTypeSelector
              value={editProjectTypeId}
              onValueChange={setEditProjectTypeId}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg">{project.name}</h3>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
          {projectType && (
            <div className="text-sm text-muted-foreground">
              Type: <span className="font-medium">{projectType.name}</span>
            </div>
          )}
        </div>
      )
    },
    {
      id: "todos",
      title: "Todo List",
      content: (
        <ProjectTodoListEnhanced
          projectId={project.id}
        />
      )
    },
    {
      id: "sessions",
      title: "Sessions",
      content: (
        <div className="space-y-4">
          {/* TODO: Replace with proper SessionsSection component that handles its own data fetching */}
          <p className="text-muted-foreground text-sm">Sessions will be loaded here</p>
        </div>
      )
    },
    {
      id: "services",
      title: "Services",
      content: (
        <ProjectServicesSection
          projectId={project.id}
        />
      )
    },
    {
      id: "payments",
      title: "Payments",
      content: (
        <ProjectPaymentsSection
          projectId={project.id}
        />
      )
    },
    {
      id: "activity",
      title: "Activity",
      content: (
        <ProjectActivitySection
          projectId={project.id}
          leadId={project.lead_id}
          leadName={lead?.name || ""}
          projectName={project.name}
          onActivityUpdated={handleActivityUpdate}
        />
      )
    }
  ];

  return (
    <>
      <ProjectDetailsLayout
        header={headerContent}
        left={leftContent}
        sections={sections}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will permanently delete
              the project and all related data including todos, sessions, payments, and activities.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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