import { useCallback } from 'react';
import { ProjectService, ProjectWithDetails, CreateProjectData, UpdateProjectData } from '@/services/ProjectService';
import { useEntityActions } from './useEntityActions';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/constants/entityConstants';

export interface UseProjectActionsOptions {
  onProjectCreated?: (project: ProjectWithDetails) => void;
  onProjectUpdated?: (project: ProjectWithDetails) => void;
  onProjectDeleted?: (projectId: string) => void;
  onStatusChanged?: (project: ProjectWithDetails) => void;
  onArchived?: (project: ProjectWithDetails, isArchived: boolean) => void;
}

export function useProjectActions(options: UseProjectActionsOptions = {}) {
  const { executeAction, getActionState, clearActionState } = useEntityActions();
  const projectService = new ProjectService();

  const createProject = useCallback(async (data: CreateProjectData) => {
    return executeAction(
      'createProject',
      () => projectService.createProject(data),
      {
        successMessage: SUCCESS_MESSAGES.CREATED('Project'),
        onSuccess: options.onProjectCreated,
        errorMessage: ERROR_MESSAGES.CREATE_FAILED
      }
    );
  }, [projectService, options.onProjectCreated]);

  const updateProject = useCallback(async (id: string, data: UpdateProjectData) => {
    return executeAction(
      'updateProject',
      () => projectService.updateProject(id, data),
      {
        successMessage: SUCCESS_MESSAGES.UPDATED('Project'),
        onSuccess: options.onProjectUpdated,
        errorMessage: ERROR_MESSAGES.UPDATE_FAILED
      }
    );
  }, [projectService, options.onProjectUpdated]);

  const deleteProject = useCallback(async (id: string) => {
    return executeAction(
      'deleteProject',
      async () => {
        await projectService.deleteProject(id);
        return true;
      },
      {
        successMessage: SUCCESS_MESSAGES.DELETED('Project'),
        onSuccess: () => options.onProjectDeleted?.(id),
        errorMessage: ERROR_MESSAGES.DELETE_FAILED
      }
    );
  }, [projectService, options.onProjectDeleted]);

  const archiveProject = useCallback(async (id: string, currentlyArchived: boolean = false) => {
    return executeAction(
      'archiveProject',
      async () => {
        await projectService.toggleArchiveStatus(id, currentlyArchived);
        const projects = await projectService.fetchProjectsWithDetails();
        const updatedProject = projects.find(p => p.id === id);
        return { project: updatedProject, isArchived: !currentlyArchived };
      },
      {
        successMessage: currentlyArchived ? 'Project restored successfully' : 'Project archived successfully',
        onSuccess: (result) => {
          if (result?.project) {
            options.onArchived?.(result.project, result.isArchived);
          }
        },
        errorMessage: currentlyArchived ? 'Failed to restore project' : 'Failed to archive project'
      }
    );
  }, [projectService, options.onArchived]);

  const changeProjectStatus = useCallback(async (
    projectId: string, 
    statusId: string
  ) => {
    return executeAction(
      'changeStatus',
      () => projectService.updateProject(projectId, { status_id: statusId }),
      {
        successMessage: 'Project status updated',
        onSuccess: options.onStatusChanged,
        errorMessage: 'Failed to update project status'
      }
    );
  }, [projectService, options.onStatusChanged]);

  const updateProjectBudget = useCallback(async (
    projectId: string, 
    basePrice: number
  ) => {
    return executeAction(
      'updateBudget',
      () => projectService.updateProject(projectId, { base_price: basePrice }),
      {
        successMessage: 'Project budget updated',
        onSuccess: options.onProjectUpdated,
        errorMessage: 'Failed to update project budget'
      }
    );
  }, [projectService, options.onProjectUpdated]);

  const reorderProjects = useCallback(async (
    projectUpdates: Array<{ id: string; sort_order: number }>
  ) => {
    return executeAction(
      'reorderProjects',
      async () => {
        const results = await Promise.all(
          projectUpdates.map(({ id, sort_order }) => 
            projectService.updateProject(id, { sort_order })
          )
        );
        return results.filter(result => result !== null);
      },
      {
        successMessage: 'Projects reordered successfully',
        errorMessage: 'Failed to reorder projects'
      }
    );
  }, [projectService]);

  const duplicateProject = useCallback(async (
    originalId: string,
    newName?: string
  ) => {
    return executeAction(
      'duplicateProject',
      async () => {
        const projects = await projectService.fetchProjectsWithDetails();
        const original = projects.find(p => p.id === originalId);
        
        if (!original) {
          throw new Error('Original project not found');
        }

        const duplicateData: CreateProjectData = {
          name: newName || `${original.name} (Copy)`,
          description: original.description || undefined,
          lead_id: original.lead_id,
          project_type_id: original.project_type_id || undefined,
          base_price: original.base_price || undefined
        };

        return projectService.createProject(duplicateData);
      },
      {
        successMessage: 'Project duplicated successfully',
        onSuccess: options.onProjectCreated,
        errorMessage: 'Failed to duplicate project'
      }
    );
  }, [projectService, options.onProjectCreated]);

  // Action state getters
  const isCreating = getActionState('createProject').loading;
  const isUpdating = getActionState('updateProject').loading;
  const isDeleting = getActionState('deleteProject').loading;
  const isArchiving = getActionState('archiveProject').loading;
  const isChangingStatus = getActionState('changeStatus').loading;
  const isUpdatingBudget = getActionState('updateBudget').loading;
  const isReordering = getActionState('reorderProjects').loading;
  const isDuplicating = getActionState('duplicateProject').loading;

  const createError = getActionState('createProject').error;
  const updateError = getActionState('updateProject').error;
  const deleteError = getActionState('deleteProject').error;
  const archiveError = getActionState('archiveProject').error;
  const statusError = getActionState('changeStatus').error;

  const clearErrors = useCallback(() => {
    clearActionState('createProject');
    clearActionState('updateProject');
    clearActionState('deleteProject');
    clearActionState('archiveProject');
    clearActionState('changeStatus');
    clearActionState('updateBudget');
    clearActionState('reorderProjects');
    clearActionState('duplicateProject');
  }, [clearActionState]);

  const hasAnyError = !!(createError || updateError || deleteError || archiveError || statusError);
  const isAnyLoading = isCreating || isUpdating || isDeleting || isArchiving || 
                     isChangingStatus || isUpdatingBudget || isReordering || isDuplicating;

  return {
    // Actions
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    changeProjectStatus,
    updateProjectBudget,
    reorderProjects,
    duplicateProject,
    
    // Loading states
    isCreating,
    isUpdating,
    isDeleting,
    isArchiving,
    isChangingStatus,
    isUpdatingBudget,
    isReordering,
    isDuplicating,
    isAnyLoading,
    
    // Error states
    createError,
    updateError,
    deleteError,
    archiveError,
    statusError,
    hasAnyError,
    
    // Utilities
    clearErrors
  };
}