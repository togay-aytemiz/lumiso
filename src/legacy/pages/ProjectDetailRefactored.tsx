import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { EntityDetailLayout } from "@/legacy/components/common/EntityDetailLayout";
import { ErrorBoundary, EntityErrorState } from "@/components/common/ErrorBoundary";
import { DetailLoadingState } from "@/legacy/components/common/LoadingStates";
import { ProjectService, ProjectWithDetails } from "@/services/ProjectService";
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
import { useTranslation } from "react-i18next";

interface ProjectDetailState {
  project: ProjectWithDetails | null;
  lead: any | null;
  projectType: any | null;
  isArchived: boolean;
}

export default function ProjectDetailRefactored() {
  const { t } = useTranslation("pages");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectTypeId, setEditProjectTypeId] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Services
  const projectService = useMemo(() => new ProjectService(), []);
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

  const fetchProjectData = useCallback(async () => {
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
      const errorMessage = err instanceof Error ? err.message : t("projectDetail.errors.loadFailed");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id, projectService, t]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

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
        successMessage: t("projectDetail.toast.updateSuccess"),
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
        successMessage: t("projectDetail.toast.deleteSuccess"),
        onSuccess: () => navigate('/projects')
      }
    );
    
    if (result) {
      setShowDeleteDialog(false);
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    
    const successMessage = isArchived
      ? t("projectDetail.toast.restoreSuccess")
      : t("projectDetail.toast.archiveSuccess");
    const result = await executeAction(
      'archive',
      () => projectService.toggleArchiveStatus(project.id, isArchived),
      {
        successMessage,
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
        error={error || t("projectDetail.errors.notFound")}
        onRetry={fetchProjectData}
        title={t("projectDetail.errors.loadFailed")}
      />
    );
  }

  const badges = [
    {
      label: project.project_status?.name || t("projectDetail.badges.noStatus"),
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
          placeholder={t("projectDetail.placeholders.name")}
          className="text-3xl font-bold border rounded-md px-4 py-3 h-auto flex-1" 
        />
      </div>
      <Textarea 
        value={editDescription} 
        onChange={e => setEditDescription(e.target.value)} 
        placeholder={t("projectDetail.placeholders.description")}
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
      label: isArchived ? t("projectDetail.actions.restore") : t("projectDetail.actions.archive"),
      onClick: handleArchive,
      icon: isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />,
      variant: 'outline' as const
    },
    {
      label: t("projectDetail.actions.delete"),
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
              <h2 className="text-lg font-semibold">{t("projectDetail.sections.overview")}</h2>
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
              title: t("projectDetail.sections.activities"),
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
              title: t("projectDetail.sections.todos"),
              content: (
                <ProjectTodoListEnhanced
                  projectId={project.id}
                />
              )
            },
            {
              id: "services",
              title: t("projectDetail.sections.services"), 
              content: (
                <ProjectServicesSection
                  projectId={project.id}
                  onServicesUpdated={fetchProjectData}
                />
              )
            },
            {
              id: "sessions",
              title: t("projectDetail.sections.sessions"),
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
              title: t("projectDetail.sections.payments"),
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
            <AlertDialogTitle>{t("projectDetail.dialogs.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectDetail.dialogs.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteState.loading}>
              {t("projectDetail.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteState.loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteState.loading ? t("projectDetail.actions.deleting") : t("projectDetail.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ErrorBoundary>
  );
}
