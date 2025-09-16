import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Archive, Settings } from "lucide-react";
import { EntityListView } from "@/components/common/EntityListView";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TableLoadingState } from "@/components/common/LoadingStates";
import { ProjectService, ProjectWithDetails } from "@/services/ProjectService";
import { useEntityData } from "@/hooks/useEntityData";
import { PROJECT_STATUS } from "@/constants/entityConstants";
import { formatDate } from "@/lib/utils";

type ViewMode = 'board' | 'list' | 'archived';

const AllProjectsSimplified = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const navigate = useNavigate();

  // Services
  const projectService = new ProjectService();

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

  const handleProjectClick = (project: ProjectWithDetails) => {
    navigate(`/projects/${project.id}`);
  };

  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
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
        <div>{project.project_status?.name || '-'}</div>
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
    </div>
  );

  if (loading) {
    return <TableLoadingState />;
  }

  return (
    <ErrorBoundary>
      <EntityListView
        title="Projects"
        subtitle={viewMode === 'archived' ? "Archived projects" : "Manage your photography projects"}
        data={displayProjects}
        columns={projectColumns}
        loading={loading}
        onRowClick={handleProjectClick}
        onAddClick={() => navigate('/projects')}
        addButtonText="Add Project"
        headerActions={viewModeButtons}
        itemsPerPage={20}
      />
    </ErrorBoundary>
  );
};

export default AllProjectsSimplified;