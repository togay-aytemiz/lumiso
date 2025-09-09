import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Workflow, WorkflowStep, WorkflowFormData } from '@/types/workflow';
import { getUserOrganizationId } from '@/lib/organizationUtils';

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      const { data: workflowsData, error } = await supabase
        .from('workflows')
        .select(`
          *,
          workflow_steps (
            id,
            step_order,
            action_type,
            action_config,
            delay_minutes,
            is_active
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform workflows to include template data from steps
      const transformedWorkflows = (workflowsData || []).map((workflow: any) => {
        const firstStep = workflow.workflow_steps?.[0];
        const actionConfig = firstStep?.action_config || {};
        
        return {
          ...workflow,
          template_id: actionConfig.template_id || '',
          channels: actionConfig.channels || ['email'],
          reminder_delay_minutes: firstStep?.delay_minutes || 0,
          email_enabled: actionConfig.channels?.includes('email') ?? true,
          whatsapp_enabled: actionConfig.channels?.includes('whatsapp') ?? true,
          sms_enabled: actionConfig.channels?.includes('sms') ?? true
        };
      });
      
      setWorkflows(transformedWorkflows as Workflow[]);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflows',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async (formData: WorkflowFormData): Promise<void> => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name,
          description: formData.description,
          trigger_type: formData.trigger_type,
          trigger_conditions: formData.trigger_conditions || {},
          is_active: formData.is_active,
        })
        .select()
        .single();

      if (workflowError) throw workflowError;

      // Create workflow steps
      if (formData.steps.length > 0) {
        const stepsToInsert = formData.steps.map((step, index) => ({
          workflow_id: workflow.id,
          step_order: index + 1,
          action_type: step.action_type,
          action_config: step.action_config,
          delay_minutes: step.delay_minutes || 0,
          conditions: step.conditions || {},
          is_active: step.is_active,
        }));

        const { error: stepsError } = await supabase
          .from('workflow_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      toast({
        title: 'Success',
        description: 'Workflow created successfully',
      });

      await fetchWorkflows();
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to create workflow',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateWorkflow = async (id: string, updates: Partial<WorkflowFormData>) => {
    try {
      // Update the main workflow
      const { error: workflowError } = await supabase
        .from('workflows')
        .update({
          name: updates.name,
          description: updates.description,
          trigger_type: updates.trigger_type,
          trigger_conditions: updates.trigger_conditions,
          is_active: updates.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (workflowError) throw workflowError;

      // Handle workflow steps if provided
      if (updates.steps) {
        // Delete existing workflow steps
        const { error: deleteError } = await supabase
          .from('workflow_steps')
          .delete()
          .eq('workflow_id', id);

        if (deleteError) throw deleteError;

        // Insert new workflow steps
        if (updates.steps.length > 0) {
          const stepsToInsert = updates.steps.map((step, index) => ({
            workflow_id: id,
            step_order: index + 1,
            action_type: step.action_type,
            action_config: step.action_config,
            delay_minutes: step.delay_minutes || 0,
            conditions: step.conditions || {},
            is_active: step.is_active,
          }));

          const { error: stepsError } = await supabase
            .from('workflow_steps')
            .insert(stepsToInsert);

          if (stepsError) throw stepsError;
        }
      }

      toast({
        title: 'Success',
        description: 'Workflow updated successfully',
      });

      await fetchWorkflows();
    } catch (error) {
      console.error('Error updating workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to update workflow',
        variant: 'destructive',
      });
    }
  };

  const deleteWorkflow = async (id: string) => {
    try {
      // First delete workflow steps
      await supabase.from('workflow_steps').delete().eq('workflow_id', id);
      
      // Then delete the workflow
      const { error } = await supabase.from('workflows').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Workflow deleted successfully',
      });

      await fetchWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete workflow',
        variant: 'destructive',
      });
    }
  };

  const toggleWorkflowStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Workflow ${isActive ? 'activated' : 'paused'} successfully`,
      });

      await fetchWorkflows();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to update workflow status',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  return {
    workflows,
    loading,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    toggleWorkflowStatus,
    refetch: fetchWorkflows,
  };
}