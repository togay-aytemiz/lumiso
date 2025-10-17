import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityDetailLayout } from "@/components/common/EntityDetailLayout";
import { ErrorBoundary, EntityErrorState } from "@/components/common/ErrorBoundary";
import { DetailLoadingState } from "@/components/common/LoadingStates";
import { ProjectService, ProjectWithDetails } from "@/services/ProjectService";
import { useEntityActions } from "@/hooks/useEntityActions";
import { SimpleProjectTypeSelect } from "@/components/SimpleProjectTypeSelect";
import { PROJECT_STATUS } from "@/constants/entityConstants";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ProjectDetailState {
  project: ProjectWithDetails | null;
  lead: any | null;
  projectType: any | null;
  isArchived: boolean;
}

export default function ProjectDetailSimplified() {
  const { t } = useTranslation("pages");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [projectDetailData, setProjectDetailData] = useState<ProjectDetailState>({
    project: null,
    lead: null, 
    projectType: null,
    isArchived: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProjectTypeId, setEditProjectTypeId] = useState("");

  // Services
  const projectService = new ProjectService();
  const { executeAction, getActionState } = useEntityActions();

  const project = projectDetailData.project;
  const lead = projectDetailData.lead;
  const projectType = projectDetailData.projectType;
  const isArchived = projectDetailData.isArchived;

  const saveState = getActionState('save');
  const deleteState = getActionState('delete');
  const archiveState = getActionState('archive');

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
      const errorMessage = err instanceof Error ? err.message : t("projectDetail.errors.notFound");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

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

  const handleCancel = () => {
    setIsEditing(false);
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditProjectTypeId(project.project_type_id || "");
    }
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
      >
        <div className="text-center py-8 text-muted-foreground">
          {t("projectDetail.placeholder.content")}
        </div>
      </EntityDetailLayout>
    </ErrorBoundary>
  );
}
