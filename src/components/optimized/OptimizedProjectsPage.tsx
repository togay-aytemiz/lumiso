import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Archive, Settings } from "lucide-react";
import { EntityListView } from "@/components/common/EntityListView";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TableLoadingState } from "@/components/common/LoadingStates";
import { ProjectService, ProjectWithDetails } from "@/services/ProjectService";
import { useEntityData } from "@/hooks/useEntityData";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { KanbanSettingsSheet } from "@/components/KanbanSettingsSheet";
import { PROJECT_STATUS } from "@/constants/entityConstants";
import { formatDate } from "@/lib/utils";
import { useMeasureRender } from '@/utils/performance';
import { useScreenReader } from '@/hooks/useAccessibility';

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
  const [showKanbanSettings, setShowKanbanSettings] = useState(false);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

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
    const viewLabels = {
      board: 'Board view',
      list: 'List view', 
      archived: 'Archived projects'
    };
    announce(`Switched to ${viewLabels[view]}`);
  }, [announce]);

  const handleProjectUpdate = useCallback((updatedProject: ProjectWithDetails) => {
    refetchProjects();
    announce(`Project ${updatedProject.name} updated`);
  }, [refetchProjects, announce]);

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
        <div className="text-sm" aria-label={`${project.session_count || 0} sessions`}>
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
  ], [refetchProjects]);

  // Memoized view mode buttons with accessibility
  const viewModeButtons = useMemo(() => (
    <div className="flex items-center gap-1" role="tablist" aria-label="View mode selection">
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
        Board
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
        List
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
        Archived ({archivedProjects.length})
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowKanbanSettings(true)}
        className="flex items-center gap-2"
        aria-label="Open kanban settings"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Settings</span>
      </Button>
    </div>
  ), [viewMode, archivedProjects.length, handleViewChange, handleViewModeKeyDown]);

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
          
          <main id="projects-content" role="tabpanel" aria-label="Projects board view">
            <ProjectKanbanBoard
              projects={projects}
              onProjectsChange={refetchProjects}
              onProjectUpdate={handleProjectUpdate}
              onQuickView={handleQuickView}
            />
          </main>
        </div>

        <EnhancedProjectDialog onProjectCreated={refetchProjects} />
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
        <KanbanSettingsSheet />
      </ErrorBoundary>
    );
  }

  // List view
  return (
    <ErrorBoundary>
      <main id="projects-content" role="tabpanel" aria-label={viewMode === 'archived' ? 'Archived projects list' : 'Projects list view'}>
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
      </main>

      <EnhancedProjectDialog onProjectCreated={refetchProjects} />
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
      <KanbanSettingsSheet />
    </ErrorBoundary>
  );
});

OptimizedProjectsPage.displayName = 'OptimizedProjectsPage';

export default OptimizedProjectsPage;