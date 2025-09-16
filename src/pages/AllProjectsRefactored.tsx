import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, Archive, Settings } from "lucide-react";
import { EntityListView } from "@/components/common/EntityListView";
import { EntityFilters } from "@/components/common/EntityFilters";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TableLoadingState } from "@/components/common/LoadingStates";
import { ProjectService, ProjectWithDetails } from "@/services/ProjectService";
import { useEntityData } from "@/hooks/useEntityData";
import { useEntityActions } from "@/hooks/useEntityActions";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { OnboardingTutorial } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { KanbanSettingsSheet } from "@/components/KanbanSettingsSheet";
import { PROJECT_STATUS } from "@/constants/entityConstants";
import { formatDate } from "@/lib/utils";

type ViewMode = 'board' | 'list' | 'archived';

const AllProjectsRefactored = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [viewingProject, setViewingProject] = useState<ProjectWithDetails | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [quickViewProject, setQuickViewProject] = useState<ProjectWithDetails | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [showKanbanSettings, setShowKanbanSettings] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { completeCurrentStep } = useOnboarding();
  const isMobile = useIsMobile();

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  
  // Services
  const projectService = new ProjectService();
  const { executeAction, getActionState } = useEntityActions();

  // Data hooks
  const { 
    data: allProjects, 
    loading, 
    refetch: refetchProjects 
  } = useEntityData<ProjectWithDetails>({
    fetchFn: () => projectService.fetchProjectsWithDetails()
  });

  // Separate projects and archived projects
  const { projects, archivedProjects } = useMemo(() => {
    const archived = allProjects.filter(p => 
      p.project_status?.name.toLowerCase() === PROJECT_STATUS.ARCHIVED
    );
    const active = allProjects.filter(p => 
      p.project_status?.name.toLowerCase() !== PROJECT_STATUS.ARCHIVED
    );
    
    return {
      projects: active,
      archivedProjects: archived
    };
  }, [allProjects]);

  const displayProjects = viewMode === 'archived' ? archivedProjects : projects;

  useEffect(() => {
    const tutorial = searchParams.get('tutorial');
    if (tutorial?.includes('true')) {
      setShowTutorial(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('tutorial');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const handleProjectClick = (project: ProjectWithDetails) => {
    navigate(`/projects/${project.id}`);
  };

  const handleQuickView = (project: ProjectWithDetails) => {
    setQuickViewProject(project);
    setShowQuickView(true);
  };

  const handleViewFullDetails = () => {
    if (quickViewProject) {
      navigate(`/projects/${quickViewProject.id}`);
      setShowQuickView(false);
    }
  };

  const handleSearchResult = (result: any) => {
    if (result.type === 'project') {
      navigate(`/projects/${result.id}`);
    } else if (result.type === 'lead') {
      navigate(`/leads/${result.id}`);
    }
  };

  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
  };

  const handleProjectUpdate = (updatedProject: ProjectWithDetails) => {
    refetchProjects();
  };

  // Create columns for list view
  const projectColumns = [
    {
      key: 'name',
      header: 'Project Name',
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div className="font-medium">{project.name}</div>
      )
    },
    {
      key: 'lead_name',
      header: 'Client',
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div>{project.lead?.name || '-'}</div>
      )
    },
    {
      key: 'project_type',
      header: 'Type',
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div>{project.project_type?.name || '-'}</div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <ProjectStatusBadge 
          projectId={project.id}
          currentStatusId={project.status_id}
          onStatusChange={() => refetchProjects()}
          editable={false}
          className="text-sm"
        />
      )
    },
    {
      key: 'sessions',
      header: 'Sessions',
      render: (project: ProjectWithDetails) => (
        <div className="text-sm">
          {project.session_count || 0} sessions
        </div>
      )
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(project.created_at)}
        </div>
      )
    }
  ];

  const viewModeButtons = (
    <div className="flex items-center gap-1">
      <Button
        variant={viewMode === 'board' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleViewChange('board')}
        className="flex items-center gap-2"
      >
        <LayoutGrid className="h-4 w-4" />
        Board
      </Button>
      <Button
        variant={viewMode === 'list' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleViewChange('list')}
        className="flex items-center gap-2"
      >
        <List className="h-4 w-4" />
        List
      </Button>
      <Button
        variant={viewMode === 'archived' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleViewChange('archived')}
        className="flex items-center gap-2"
      >
        <Archive className="h-4 w-4" />
        Archived ({archivedProjects.length})
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowKanbanSettings(true)}
        className="flex items-center gap-2"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Settings</span>
      </Button>
    </div>
  );

  if (loading) {
    return <TableLoadingState />;
  }

  // Board/Kanban view
  if (viewMode === 'board') {
    return (
      <ErrorBoundary>
        <div className="min-h-screen p-4 sm:p-6">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Projects</h1>
              <p className="text-muted-foreground">Manage your photography projects</p>
            </div>
            {viewModeButtons}
          </div>
          
          <ProjectKanbanBoard 
            projects={projects}
            onProjectClick={handleProjectClick}
            onQuickView={handleQuickView}
            onProjectUpdate={handleProjectUpdate}
          />
        </div>

        <EnhancedProjectDialog onProjectAdded={refetchProjects} />
        <ViewProjectDialog 
          project={viewingProject}
          open={showViewDialog}
          onOpenChange={setShowViewDialog}
        />
        <ProjectSheetView 
          project={quickViewProject}
          open={showQuickView}
          onOpenChange={setShowQuickView}
          onViewFullDetails={handleViewFullDetails}
        />
        <KanbanSettingsSheet 
          open={showKanbanSettings}
          onOpenChange={setShowKanbanSettings}
        />
      </ErrorBoundary>
    );
  }

  // List view
  return (
    <ErrorBoundary>
      <EntityListView
        title="Projects"
        subtitle={viewMode === 'archived' ? "Archived projects" : "Manage your photography projects"}
        data={displayProjects}
        columns={projectColumns}
        loading={loading}
        onRowClick={handleProjectClick}
        onAddClick={() => {/* Open add project dialog */}}
        addButtonText="Add Project"
        headerActions={viewModeButtons}
        itemsPerPage={20}
      />

      <EnhancedProjectDialog onProjectAdded={refetchProjects} />
      <ViewProjectDialog 
        project={viewingProject}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      />
      <ProjectSheetView 
        project={quickViewProject}
        open={showQuickView}
        onOpenChange={setShowQuickView}
        onViewFullDetails={handleViewFullDetails}
      />
      <KanbanSettingsSheet 
        open={showKanbanSettings}
        onOpenChange={setShowKanbanSettings}
      />
    </ErrorBoundary>
  );
};

export default AllProjectsRefactored;