import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Archive, Settings, Plus } from "lucide-react";
import { EntityListView } from "@/legacy/components/common/EntityListView";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TableLoadingState } from "@/legacy/components/common/LoadingStates";
import { ProjectService, ProjectWithDetails } from "@/services/ProjectService";
import { useEntityData } from "@/hooks/useEntityData";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { KanbanSettingsSheet } from "@/components/KanbanSettingsSheet";
import { PROJECT_STATUS } from "@/constants/entityConstants";
import { formatDate } from "@/lib/utils";
import { useMeasureRender } from "@/utils/performance";
import { useScreenReader } from "@/hooks/useAccessibility";
import { useTranslation } from "react-i18next";
import { ProjectCreationWizardSheet } from "@/features/project-creation";

type ViewMode = 'board' | 'list' | 'archived';

/**
 * Optimized Projects page with performance monitoring and accessibility
 */
const OptimizedProjectsPage = React.memo(() => {
  // Performance monitoring
  useMeasureRender('OptimizedProjectsPage');
  
  // Accessibility
  const { announce } = useScreenReader();

  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [viewingProject, setViewingProject] = useState<ProjectWithDetails | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [quickViewProject, setQuickViewProject] = useState<ProjectWithDetails | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [isProjectWizardOpen, setProjectWizardOpen] = useState(false);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { t } = useTranslation(["pages", "navigation", "common"]);

  // Services - memoized to prevent recreation
  const projectService = useMemo(() => new ProjectService(), []);

  // Data hooks
  const { 
    data: allProjects, 
    loading, 
    refetch: refetchProjects 
  } = useEntityData<ProjectWithDetails>({
    fetchFn: useCallback(() => projectService.fetchProjectsWithDetails(), [projectService])
  });

  // Memoized project separation for performance
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

  const displayProjects = useMemo(() => 
    viewMode === 'archived' ? archivedProjects : projects,
    [viewMode, archivedProjects, projects]
  );

  // Optimized event handlers with useCallback
  const handleProjectClick = useCallback((project: ProjectWithDetails) => {
    navigate(`/projects/${project.id}`);
    announce(`Navigating to project: ${project.name}`);
  }, [navigate, announce]);

  const handleQuickView = useCallback((project: ProjectWithDetails) => {
    setQuickViewProject(project);
    setShowQuickView(true);
    announce(`Opening quick view for project: ${project.name}`);
  }, [announce]);

  const handleViewFullDetails = useCallback(() => {
    if (quickViewProject) {
      navigate(`/projects/${quickViewProject.id}`);
      setShowQuickView(false);
      announce(`Navigating to full details for project: ${quickViewProject.name}`);
    }
  }, [quickViewProject, navigate, announce]);

  const handleViewChange = useCallback((view: ViewMode) => {
    setViewMode(view);
    const viewLabels: Record<ViewMode, string> = {
      board: t("projects.board_view"),
      list: t("projects.list_view"),
      archived: t("projects.archived_view"),
    };
    announce(t("projects.accessibility.switchView", { view: viewLabels[view] }));
  }, [announce, t]);

  const handleProjectUpdate = useCallback((updatedProject: ProjectWithDetails) => {
    refetchProjects();
    announce(t("projects.accessibility.projectUpdated", { name: updatedProject.name }));
  }, [refetchProjects, announce, t]);

  // Keyboard navigation for view mode buttons
  const handleViewModeKeyDown = useCallback((e: React.KeyboardEvent, view: ViewMode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleViewChange(view);
    }
  }, [handleViewChange]);

  // Memoized columns for list view
  const projectColumns = useMemo(() => [
    {
      key: 'name',
      header: t("projects.project_name"),
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div className="font-medium">{project.name}</div>
      )
    },
    {
      key: 'lead_name',
      header: t("projects.client"),
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div>{project.lead?.name || '-'}</div>
      )
    },
    {
      key: 'project_type',
      header: t("common:labels.type"),
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div>{project.project_type?.name || '-'}</div>
      )
    },
    {
      key: 'status',
      header: t("common:labels.status"),
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
      header: t("projects.sessions"),
      render: (project: ProjectWithDetails) => {
        const count = project.session_count || 0;
        return (
          <div
            className="text-sm"
            aria-label={t("projects.aria.sessionsCount", { count })}
          >
            {t("projects.sessionsCountLabel", { count })}
          </div>
        );
      }
    },
    {
      key: 'created_at',
      header: t("projects.created"),
      sortable: true,
      render: (project: ProjectWithDetails) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(project.created_at)}
        </div>
      )
    }
  ], [refetchProjects, t]);

  // Memoized view mode buttons with accessibility
  const viewModeButtons = useMemo(() => (
    <div className="flex items-center gap-1" role="tablist" aria-label={t("projects.aria.viewModeSelection")}>
      <Button
        variant={viewMode === 'board' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleViewChange('board')}
        onKeyDown={(e) => handleViewModeKeyDown(e, 'board')}
        className="flex items-center gap-2"
        role="tab"
        aria-selected={viewMode === 'board'}
        aria-controls="projects-content"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        {t("projects.board_view")}
      </Button>
      <Button
        variant={viewMode === 'list' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleViewChange('list')}
        onKeyDown={(e) => handleViewModeKeyDown(e, 'list')}
        className="flex items-center gap-2"
        role="tab"
        aria-selected={viewMode === 'list'}
        aria-controls="projects-content"
      >
        <List className="h-4 w-4" aria-hidden="true" />
        {t("projects.list_view")}
      </Button>
      <Button
        variant={viewMode === 'archived' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleViewChange('archived')}
        onKeyDown={(e) => handleViewModeKeyDown(e, 'archived')}
        className="flex items-center gap-2"
        role="tab"
        aria-selected={viewMode === 'archived'}
        aria-controls="projects-content"
      >
        <Archive className="h-4 w-4" aria-hidden="true" />
        {t("projects.archived_view")} ({archivedProjects.length})
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={() => setProjectWizardOpen(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("common:buttons.add_project")}
      </Button>
      <KanbanSettingsSheet>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          aria-label={t("projects.aria.openKanbanSettings")}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t("navigation:settings")}</span>
        </Button>
      </KanbanSettingsSheet>
    </div>
  ), [viewMode, archivedProjects.length, handleViewChange, handleViewModeKeyDown, t]);

  if (loading) {
    return <TableLoadingState />;
  }

  // Board/Kanban view
  if (viewMode === 'board') {
    return (
      <>
        <ProjectCreationWizardSheet
          isOpen={isProjectWizardOpen}
          onOpenChange={setProjectWizardOpen}
          entrySource="legacy_board"
          onProjectCreated={refetchProjects}
        />
        <ErrorBoundary>
          <div className="min-h-screen p-4 sm:p-6">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">{t("projects.title")}</h1>
                <p className="text-muted-foreground">{t("projects.page_subtitle")}</p>
              </div>
              {viewModeButtons}
            </div>
            
            <main id="projects-content" role="tabpanel" aria-label={t("projects.aria.boardView")}>
              <ProjectKanbanBoard
                projects={projects}
                onProjectsChange={refetchProjects}
                onProjectUpdate={handleProjectUpdate}
                onQuickView={handleQuickView}
              />
            </main>
          </div>

          <ViewProjectDialog 
            project={viewingProject}
            open={showViewDialog}
            onOpenChange={setShowViewDialog}
            onProjectUpdated={refetchProjects}
            leadName={viewingProject?.lead?.name || ""}
          />
          <ProjectSheetView 
            project={quickViewProject}
            open={showQuickView}
            onOpenChange={setShowQuickView}
            onProjectUpdated={refetchProjects}
            leadName={quickViewProject?.lead?.name || ""}
            onViewFullDetails={handleViewFullDetails}
          />
      </ErrorBoundary>
      </>
    );
  }

  // List view
  return (
    <>
      <ProjectCreationWizardSheet
        isOpen={isProjectWizardOpen}
        onOpenChange={setProjectWizardOpen}
        entrySource="legacy_list"
        onProjectCreated={refetchProjects}
      />
      <ErrorBoundary>
        <main
          id="projects-content"
          role="tabpanel"
          aria-label={viewMode === 'archived' ? t("projects.aria.archivedList") : t("projects.aria.listView")}
        >
          <EntityListView
            title={t("projects.title")}
            subtitle={viewMode === 'archived' ? t("projects.archivedProjects") : t("projects.page_subtitle")}
            data={displayProjects}
            columns={projectColumns}
            loading={loading}
            onRowClick={handleProjectClick}
            onAddClick={() => setProjectWizardOpen(true)}
            addButtonText={t("common:buttons.add_project")}
            headerActions={viewModeButtons}
            itemsPerPage={20}
          />
        </main>

        <ViewProjectDialog 
          project={viewingProject}
          open={showViewDialog}
          onOpenChange={setShowViewDialog}
          onProjectUpdated={refetchProjects}
          leadName={viewingProject?.lead?.name || ""}
        />
        <ProjectSheetView 
          project={quickViewProject}
          open={showQuickView}
          onOpenChange={setShowQuickView}
          onProjectUpdated={refetchProjects}
          leadName={quickViewProject?.lead?.name || ""}
          onViewFullDetails={handleViewFullDetails}
        />
      </ErrorBoundary>
    </>
  );
});

OptimizedProjectsPage.displayName = 'OptimizedProjectsPage';

export default OptimizedProjectsPage;
