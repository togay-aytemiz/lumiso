import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { EntityDetailLayout } from "@/components/common/EntityDetailLayout";
import { ErrorBoundary, EntityErrorState } from "@/components/common/ErrorBoundary";
import { DetailLoadingState } from "@/components/common/LoadingStates";
import { ProjectService, ProjectWithDetails } from "@/services/ProjectService";
import { useEntityData } from "@/hooks/useEntityData";
import { useEntityActions } from "@/hooks/useEntityActions";
import { ProjectActivitySection } from "@/components/ProjectActivitySection";
import { ProjectTodoListEnhanced } from "@/components/ProjectTodoListEnhanced";
import { ProjectServicesSection } from "@/components/ProjectServicesSection";
import { SessionsSection } from "@/components/SessionsSection";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { SimpleProjectTypeSelect } from "@/components/SimpleProjectTypeSelect";
import { ProjectPaymentsSection } from "@/components/ProjectPaymentsSection";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import { PROJECT_STATUS } from "@/constants/entityConstants";

interface ProjectDetailState {
  project: ProjectWithDetails | null;
  lead: any | null;
  projectType: any | null;
  isArchived: boolean;
}

export default function ProjectDetailRefactored() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectTypeId, setEditProjectTypeId] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [servicesVersion, setServicesVersion] = useState(0);

  // Services
  const projectService = new ProjectService();
  const { executeAction, getActionState } = useEntityActions();

  // Data state management
  const [projectDetailData, setProjectDetailData] = useState<ProjectDetailState>({
    project: null,
    lead: null, 
    projectType: null,
    isArchived: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjectData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const project = await projectService.fetchProjectById(id);
      const lead = project.lead_id ? await projectService.fetchLeadById(project.lead_id) : null;
      const projectType = project.project_type_id ? await projectService.fetchProjectTypeById(project.project_type_id) : null;
      const isArchived = project.project_status?.name.toLowerCase() === PROJECT_STATUS.ARCHIVED;
      
      setProjectDetailData({ project, lead, projectType, isArchived });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load project';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const project = projectDetailData.project;
  const lead = projectDetailData.lead;
  const projectType = projectDetailData.projectType;
  const isArchived = projectDetailData.isArchived;

  const saveState = getActionState('save');
  const deleteState = getActionState('delete');
  const archiveState = getActionState('archive');

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditProjectTypeId(project.project_type_id || "");
    }
  }, [project]);

  const handleSave = async () => {
    if (!project || !editName.trim() || !editProjectTypeId) return;
    
    const result = await executeAction(
      'save',
      () => projectService.updateProject(project.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        project_type_id: editProjectTypeId
      }),
      {
        successMessage: "Project updated successfully",
        onSuccess: () => {
          setIsEditing(false);
          fetchProjectData();
        }
      }
    );
  };

  const handleDelete = async () => {
    if (!project) return;
    
    const result = await executeAction(
      'delete',
      () => projectService.deleteProject(project.id),
      {
        successMessage: "Project deleted successfully",
        onSuccess: () => navigate('/projects')
      }
    );
    
    if (result) {
      setShowDeleteDialog(false);
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    
    const action = isArchived ? 'restore' : 'archive';
    const result = await executeAction(
      'archive',
      () => projectService.toggleArchiveStatus(project.id, isArchived),
      {
        successMessage: `Project ${action}d successfully`,
        onSuccess: () => fetchProjectData()
      }
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditProjectTypeId(project.project_type_id || "");
    }
  };

  const handleStatusChange = () => {
    fetchProjectData();
  };

  if (loading) {
    return <DetailLoadingState />;
  }

  if (error || !project) {
    return (
      <EntityErrorState 
        error={error || 'Project not found'} 
        onRetry={fetchProjectData}
        title="Failed to load project"
      />
    );
  }

  const badges = [
    {
      label: project.project_status?.name || 'No Status',
      variant: 'outline' as const,
      className: 'text-sm'
    }
  ];

  if (projectType) {
    badges.push({
      label: projectType.name.toUpperCase(),
      variant: 'outline' as const,
      className: 'text-sm'
    });
  }

  const editForm = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input 
          value={editName} 
          onChange={e => setEditName(e.target.value)} 
          placeholder="Project name" 
          className="text-3xl font-bold border rounded-md px-4 py-3 h-auto flex-1" 
        />
      </div>
      <Textarea 
        value={editDescription} 
        onChange={e => setEditDescription(e.target.value)} 
        placeholder="Project description (optional)" 
        className="text-lg border rounded-md px-4 py-3 resize-none" 
        rows={3} 
      />
      <SimpleProjectTypeSelect 
        value={editProjectTypeId} 
        onValueChange={setEditProjectTypeId} 
        disabled={saveState.loading} 
        required 
      />
    </div>
  );

  const actions = [
    {
      label: isArchived ? 'Restore Project' : 'Archive Project',
      onClick: handleArchive,
      icon: isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />,
      variant: 'outline' as const
    },
    {
      label: 'Delete Project',
      onClick: () => setShowDeleteDialog(true),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive' as const
    }
  ];

  return (
    <ErrorBoundary>
      <EntityDetailLayout
        title={project.name}
        description={project.description}
        badges={badges}
        onBack={() => navigate('/projects')}
        onEdit={() => setIsEditing(true)}
        onSave={handleSave}
        onCancel={handleCancel}
        isEditing={isEditing}
        isSaving={saveState.loading}
        canEdit={!isArchived}
        editForm={editForm}
        actions={actions}
      >
        <ProjectDetailsLayout 
          header={
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Project Overview</h2>
              <UnifiedClientDetails 
                lead={lead}
              />
            </div>
          }
          left={
            <div className="space-y-4">
              <ProjectStatusBadge 
                projectId={project.id}
                currentStatusId={project.status_id}
                onStatusChange={handleStatusChange}
                editable={!isArchived}
                className="text-sm w-full justify-center"
              />
            </div>
          }
          sections={[
            {
              id: "activities",
              title: "Activities",
              content: (
                <ProjectActivitySection
                  projectId={project.id}
                  leadId={project.lead_id}
                  leadName={lead?.name || ""}
                  projectName={project.name}
                  onActivityUpdated={fetchProjectData}
                />
              )
            },
            {
              id: "todos", 
              title: "Todos",
              content: (
                <ProjectTodoListEnhanced
                  projectId={project.id}
                />
              )
            },
            {
              id: "services",
              title: "Services", 
              content: (
                <ProjectServicesSection
                  projectId={project.id}
                  onServicesUpdated={() => {
                    setServicesVersion(prev => prev + 1);
                    fetchProjectData();
                  }}
                />
              )
            },
            {
              id: "sessions",
              title: "Sessions",
              content: (
                <SessionsSection
                  sessions={[]}
                  loading={false}
                  leadId={project.lead_id}
                  projectId={project.id}
                  leadName={lead?.name || ""}
                  projectName={project.name}
                  onSessionUpdated={fetchProjectData}
                  onDeleteSession={async (sessionId: string) => {
                    // Handle session deletion
                    fetchProjectData();
                  }}
                />
              )
            },
            {
              id: "payments",
              title: "Payments",
              content: (
                <ProjectPaymentsSection
                  projectId={project.id}
                  onPaymentsUpdated={fetchProjectData}
                />
              )
            }
          ]}
        />
      </EntityDetailLayout>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project and all associated data including sessions, todos, and payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteState.loading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteState.loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteState.loading ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ErrorBoundary>
  );
}