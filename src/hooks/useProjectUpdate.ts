import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  sendAssignmentNotification, 
  sendMilestoneNotification, 
  getCurrentUserAndOrg,
  getAssignmentChanges,
  isSignificantStatusChange
} from '@/lib/notificationUtils';

interface UseProjectUpdateProps {
  projectId: string;
  onSuccess?: () => void;
}

export function useProjectUpdate({ projectId, onSuccess }: UseProjectUpdateProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const updateProject = async (updates: Record<string, any>) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      // Get current project state before update for change detection
      const { data: currentProject } = await supabase
        .from('projects')
        .select(`
          name, 
          status_id, 
          assignees,
          project_statuses!projects_status_id_fkey(name)
        `)
        .eq('id', projectId)
        .single();

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

      if (error) throw error;

      // Handle notifications for specific field changes
      const { userId, orgId } = await getCurrentUserAndOrg();
      
      if (userId && orgId && currentProject) {
        // Handle status changes
        if ('status_id' in updates) {
          // Get new status name
          const { data: newStatus } = await supabase
            .from('project_statuses')
            .select('name')
            .eq('id', updates.status_id)
            .single();

          const oldStatusName = currentProject.project_statuses?.name || '';
          const newStatusName = newStatus?.name || '';

          if (isSignificantStatusChange(oldStatusName, newStatusName)) {
            await sendMilestoneNotification({
              type: 'project',
              entity_id: projectId,
              entity_name: currentProject.name || 'Unnamed Project',
              old_status: oldStatusName,
              new_status: newStatusName,
              changed_by_id: userId,
              organization_id: orgId,
              assignee_ids: currentProject.assignees || []
            });
          }
        }

        // Handle assignee changes
        if ('assignees' in updates) {
          const newAssignees = updates.assignees || [];
          const { added, removed } = getAssignmentChanges(currentProject.assignees || [], newAssignees);
          
          if (added.length > 0) {
            await sendAssignmentNotification({
              type: 'project',
              entity_id: projectId,
              entity_name: currentProject.name || 'Unnamed Project',
              assignee_ids: added,
              assigned_by_id: userId,
              organization_id: orgId,
              action: 'assigned'
            });
          }
          
          if (removed.length > 0) {
            await sendAssignmentNotification({
              type: 'project',
              entity_id: projectId,
              entity_name: currentProject.name || 'Unnamed Project',
              assignee_ids: removed,
              assigned_by_id: userId,
              organization_id: orgId,
              action: 'unassigned'
            });
          }
        }
      }

      toast({
        title: "Project updated",
        description: "The project has been updated successfully.",
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Update failed",
        description: "Failed to update the project. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  const updateProjectStatus = async (statusId: string) => {
    await updateProject({ status_id: statusId });
  };

  const updateProjectAssignees = async (assignees: string[]) => {
    await updateProject({ assignees });
  };

  return {
    isUpdating,
    updateProject,
    updateProjectStatus,
    updateProjectAssignees
  };
}