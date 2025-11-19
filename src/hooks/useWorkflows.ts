import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Workflow, WorkflowStep, WorkflowFormData } from '@/types/workflow';
import { getUserOrganizationId } from '@/lib/organizationUtils';
import { useTranslation } from 'react-i18next';

type NotificationChannel = NonNullable<WorkflowStep['action_config']['channels']>[number];

type WorkflowWithSteps = Workflow & {
  workflow_steps?: Array<Pick<WorkflowStep, 'action_config' | 'delay_minutes'>>;
};

export type WorkflowWithMetadata = WorkflowWithSteps & {
  template_id: string;
  channels: NotificationChannel[];
  reminder_delay_minutes: number;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return undefined;
};

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<WorkflowWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation('pages');
  const getToastKey = useCallback((key: string) => `workflows.toasts.${key}`, []);

  const showSuccessToast = useCallback(
    (key: string, options?: Record<string, unknown>) => {
      toast({
        title: t('workflows.toasts.successTitle'),
        description: t(getToastKey(key), options),
      });
    },
    [getToastKey, t, toast]
  );

  const showErrorToast = useCallback(
    (key: string, errorMessage?: string) => {
      toast({
        title: t('workflows.toasts.errorTitle'),
        description: errorMessage ?? t(getToastKey(key)),
        variant: 'destructive',
      });
    },
    [getToastKey, t, toast]
  );

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      const [{ data: workflowsData, error }, { data: templatesData, error: templatesError }] = await Promise.all([
        supabase
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
          .order('created_at', { ascending: false }),
        supabase
          .from('message_templates')
          .select('id, template_slug')
          .eq('organization_id', organizationId)
      ]);

      if (error) throw error;
      if (templatesError) throw templatesError;

      const templateSlugMap = new Map<string, string>();
      (templatesData ?? []).forEach(template => {
        const slug = template.template_slug;
        if (slug) {
          templateSlugMap.set(slug, template.id);
        }
      });
      
      // Transform workflows to include template data from steps
      const transformedWorkflows: WorkflowWithMetadata[] = (workflowsData || []).map((workflow) => {
        const workflowWithSteps = workflow as WorkflowWithSteps;
        const firstStep = workflowWithSteps.workflow_steps?.[0];
        const actionConfig = firstStep?.action_config ?? {};
        const channels = actionConfig.channels ?? ['email'];
        const templateSlug = actionConfig.template_slug ?? actionConfig.templateSlug;
        const templateIdFromSlug = typeof templateSlug === 'string' ? templateSlugMap.get(templateSlug) : undefined;
        const templateId = actionConfig.template_id ?? actionConfig.templateId ?? templateIdFromSlug ?? '';

        return {
          ...workflowWithSteps,
          template_id: templateId,
          channels,
          reminder_delay_minutes: firstStep?.delay_minutes ?? 0,
          email_enabled: channels.includes('email'),
          whatsapp_enabled: channels.includes('whatsapp'),
          sms_enabled: channels.includes('sms')
        };
      });
      
      setWorkflows(transformedWorkflows);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      showErrorToast('loadError');
    } finally {
      setLoading(false);
    }
  }, [showErrorToast]);

  const createWorkflow = useCallback(async (formData: WorkflowFormData): Promise<void> => {
    try {
      // Input validation
      if (!formData.name?.trim()) {
        throw new Error('Workflow name is required');
      }
      if (!formData.trigger_type) {
        throw new Error('Trigger type is required');
      }
      if (!formData.steps || formData.steps.length === 0) {
        throw new Error('At least one workflow step is required');
      }

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Validate workflow steps
      for (const [index, step] of formData.steps.entries()) {
        if (!step.action_type) {
          throw new Error(`Step ${index + 1}: Action type is required`);
        }
        if (!step.action_config || Object.keys(step.action_config).length === 0) {
          throw new Error(`Step ${index + 1}: Action configuration is required`);
        }
        if (step.delay_minutes && (step.delay_minutes < 0 || step.delay_minutes > 43200)) {
          throw new Error(`Step ${index + 1}: Delay must be between 0 and 43200 minutes (30 days)`);
        }
      }

      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          trigger_type: formData.trigger_type,
          trigger_conditions: formData.trigger_conditions || {},
          is_active: formData.is_active,
        })
        .select()
        .single();

      if (workflowError) throw workflowError;

      // Create workflow steps with validation
      if (formData.steps.length > 0) {
        const stepsToInsert = formData.steps.map((step, index) => ({
          workflow_id: workflow.id,
          step_order: index + 1,
          action_type: step.action_type,
          action_config: step.action_config,
          delay_minutes: Math.max(0, Math.min(43200, step.delay_minutes || 0)),
          conditions: step.conditions || {},
          is_active: step.is_active !== false, // Default to true
        }));

        const { error: stepsError } = await supabase
          .from('workflow_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      showSuccessToast('createSuccess');

      await fetchWorkflows();
    } catch (error: unknown) {
      console.error('Error creating workflow:', error);
      showErrorToast('createError', getErrorMessage(error));
      throw error;
    }
  }, [fetchWorkflows, showErrorToast, showSuccessToast]);

  const updateWorkflow = useCallback(async (id: string, updates: Partial<WorkflowFormData>) => {
    try {
      // Input validation
      if (!id) {
        throw new Error('Workflow ID is required');
      }
      
      if (updates.name !== undefined && !updates.name?.trim()) {
        throw new Error('Workflow name cannot be empty');
      }
      
      if (updates.steps) {
        // Validate workflow steps
        for (const [index, step] of updates.steps.entries()) {
          if (!step.action_type) {
            throw new Error(`Step ${index + 1}: Action type is required`);
          }
          if (!step.action_config || Object.keys(step.action_config).length === 0) {
            throw new Error(`Step ${index + 1}: Action configuration is required`);
          }
          if (step.delay_minutes && (step.delay_minutes < 0 || step.delay_minutes > 43200)) {
            throw new Error(`Step ${index + 1}: Delay must be between 0 and 43200 minutes (30 days)`);
          }
        }
      }

      // Update the main workflow
      const updateData: Partial<Workflow> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description?.trim() || null;
      if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
      if (updates.trigger_conditions !== undefined) updateData.trigger_conditions = updates.trigger_conditions;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const { error: workflowError } = await supabase
        .from('workflows')
        .update(updateData)
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

        // Insert new workflow steps with validation
        if (updates.steps.length > 0) {
          const stepsToInsert = updates.steps.map((step, index) => ({
            workflow_id: id,
            step_order: index + 1,
            action_type: step.action_type,
            action_config: step.action_config,
            delay_minutes: Math.max(0, Math.min(43200, step.delay_minutes || 0)),
            conditions: step.conditions || {},
            is_active: step.is_active !== false, // Default to true
          }));

          const { error: stepsError } = await supabase
            .from('workflow_steps')
            .insert(stepsToInsert);

          if (stepsError) throw stepsError;
        }
      }

      showSuccessToast('updateSuccess');

      await fetchWorkflows();
    } catch (error: unknown) {
      console.error('Error updating workflow:', error);
      showErrorToast('updateError', getErrorMessage(error));
    }
  }, [fetchWorkflows, showErrorToast, showSuccessToast]);

  const deleteWorkflow = useCallback(async (id: string) => {
    try {
      // First delete workflow steps
      await supabase.from('workflow_steps').delete().eq('workflow_id', id);
      
      // Then delete the workflow
      const { error } = await supabase.from('workflows').delete().eq('id', id);
      if (error) throw error;

      showSuccessToast('deleteSuccess');

      await fetchWorkflows();
    } catch (error: unknown) {
      console.error('Error deleting workflow:', error);
      showErrorToast('deleteError', getErrorMessage(error));
    }
  }, [fetchWorkflows, showErrorToast, showSuccessToast]);

  const toggleWorkflowStatus = useCallback(async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      showSuccessToast(isActive ? 'toggleActive' : 'togglePaused');

      await fetchWorkflows();
    } catch (error: unknown) {
      console.error('Error toggling workflow:', error);
      showErrorToast('toggleError', getErrorMessage(error));
    }
  }, [fetchWorkflows, showErrorToast, showSuccessToast]);

  useEffect(() => {
    void fetchWorkflows();
  }, [fetchWorkflows]);

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
