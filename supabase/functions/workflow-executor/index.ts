import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkflowTriggerRequest {
  action: 'trigger' | 'execute';
  trigger_type: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  trigger_data?: any;
  organization_id: string;
  workflow_execution_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Workflow executor started');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { action, trigger_type, trigger_entity_type, trigger_entity_id, trigger_data, organization_id, workflow_execution_id }: WorkflowTriggerRequest = await req.json();
    console.log(`Processing workflow action: ${action} for trigger: ${trigger_type}`);

    let result;

    switch (action) {
      case 'trigger':
        result = await triggerWorkflows(adminSupabase, {
          trigger_type,
          trigger_entity_type,
          trigger_entity_id,
          trigger_data,
          organization_id
        });
        break;
      
      case 'execute':
        if (!workflow_execution_id) {
          throw new Error('workflow_execution_id required for execute action');
        }
        result = await executeWorkflowSteps(adminSupabase, workflow_execution_id);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      result,
      processed_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in workflow executor:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

// Find and trigger matching workflows
async function triggerWorkflows(supabase: any, triggerData: {
  trigger_type: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  trigger_data: any;
  organization_id: string;
}) {
  const { trigger_type, trigger_entity_type, trigger_entity_id, trigger_data, organization_id } = triggerData;
  
  console.log(`Looking for workflows with trigger: ${trigger_type} in org: ${organization_id}`);

  // Find active workflows that match this trigger
  const { data: workflows, error: workflowsError } = await supabase
    .from('workflows')
    .select('*')
    .eq('trigger_type', trigger_type)
    .eq('organization_id', organization_id)
    .eq('is_active', true);

  if (workflowsError) {
    console.error('Error fetching workflows:', workflowsError);
    throw workflowsError;
  }

  if (!workflows || workflows.length === 0) {
    console.log(`No active workflows found for trigger: ${trigger_type}`);
    return { triggered_workflows: 0 };
  }

  console.log(`Found ${workflows.length} matching workflows`);

  const executions = [];

  // Create workflow executions for matching workflows
  for (const workflow of workflows) {
    try {
      // Check trigger conditions if they exist
      if (workflow.trigger_conditions && Object.keys(workflow.trigger_conditions).length > 0) {
        const conditionsMet = evaluateTriggerConditions(workflow.trigger_conditions, trigger_data);
        if (!conditionsMet) {
          console.log(`Skipping workflow ${workflow.id}: conditions not met`);
          continue;
        }
      }

      // Create workflow execution record
      const { data: execution, error: executionError } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflow.id,
          trigger_entity_type,
          trigger_entity_id,
          status: 'pending',
          execution_log: [{
            timestamp: new Date().toISOString(),
            action: 'triggered',
            details: `Workflow triggered by ${trigger_type}`,
            trigger_data
          }]
        })
        .select()
        .single();

      if (executionError) {
        console.error(`Error creating execution for workflow ${workflow.id}:`, executionError);
        continue;
      }

      executions.push(execution);
      console.log(`Created execution ${execution.id} for workflow ${workflow.id}`);

      // Execute workflow steps asynchronously
      executeWorkflowSteps(supabase, execution.id).catch(error => {
        console.error(`Error executing workflow ${workflow.id}:`, error);
      });

    } catch (error) {
      console.error(`Error processing workflow ${workflow.id}:`, error);
    }
  }

  return { triggered_workflows: executions.length, executions };
}

// Execute workflow steps
async function executeWorkflowSteps(supabase: any, executionId: string) {
  console.log(`Executing workflow steps for execution: ${executionId}`);

  // Get execution and workflow details
  const { data: execution, error: executionError } = await supabase
    .from('workflow_executions')
    .select(`
      *,
      workflows:workflow_id (*)
    `)
    .eq('id', executionId)
    .single();

  if (executionError || !execution) {
    throw new Error(`Failed to fetch workflow execution: ${executionError?.message}`);
  }

  // Update execution status to running
  await supabase
    .from('workflow_executions')
    .update({ 
      status: 'running',
      started_at: new Date().toISOString()
    })
    .eq('id', executionId);

  try {
    // Get workflow steps
    const { data: steps, error: stepsError } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', execution.workflow_id)
      .eq('is_active', true)
      .order('step_order');

    if (stepsError) {
      throw new Error(`Failed to fetch workflow steps: ${stepsError.message}`);
    }

    if (!steps || steps.length === 0) {
      console.log(`No active steps found for workflow ${execution.workflow_id}`);
      await updateExecutionStatus(supabase, executionId, 'completed', 'No steps to execute');
      return { executed_steps: 0 };
    }

    console.log(`Executing ${steps.length} steps for workflow ${execution.workflow_id}`);

    // Execute steps in order
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        // Apply delay if specified (for subsequent steps)
        if (i > 0 && step.delay_minutes && step.delay_minutes > 0) {
          console.log(`Applying delay of ${step.delay_minutes} minutes for step ${step.id}`);
          // In a real implementation, you might want to schedule this step for later
          // For now, we'll continue immediately but log the delay
        }

        // Check step conditions if they exist
        if (step.conditions && Object.keys(step.conditions).length > 0) {
          const conditionsMet = evaluateStepConditions(step.conditions, execution);
          if (!conditionsMet) {
            console.log(`Skipping step ${step.id}: conditions not met`);
            continue;
          }
        }

        // Execute the step
        await executeWorkflowStep(supabase, executionId, step, execution);

        // Log step execution
        const currentLog = execution.execution_log || [];
        currentLog.push({
          timestamp: new Date().toISOString(),
          action: 'step_executed',
          step_id: step.id,
          step_order: step.step_order,
          action_type: step.action_type,
          details: `Executed ${step.action_type} step`
        });

        await supabase
          .from('workflow_executions')
          .update({ execution_log: currentLog })
          .eq('id', executionId);

      } catch (stepError) {
        console.error(`Error executing step ${step.id}:`, stepError);
        
        // Log step error
        const currentLog = execution.execution_log || [];
        currentLog.push({
          timestamp: new Date().toISOString(),
          action: 'step_failed',
          step_id: step.id,
          step_order: step.step_order,
          error: stepError.message
        });

        await supabase
          .from('workflow_executions')
          .update({ execution_log: currentLog })
          .eq('id', executionId);

        // Continue with next step (don't fail entire workflow for one step)
      }
    }

    // Mark execution as completed
    await updateExecutionStatus(supabase, executionId, 'completed', `Executed ${steps.length} steps`);
    return { executed_steps: steps.length };

  } catch (error) {
    console.error(`Error executing workflow:`, error);
    await updateExecutionStatus(supabase, executionId, 'failed', error.message);
    throw error;
  }
}

// Execute individual workflow step
async function executeWorkflowStep(supabase: any, executionId: string, step: any, execution: any) {
  console.log(`Executing step ${step.id}: ${step.action_type}`);

  const { action_type, action_config } = step;

  switch (action_type) {
    case 'send_notification':
    case 'send_email':
    case 'send_sms':
    case 'send_whatsapp':
      await executeSendMessageStep(supabase, step, execution);
      break;
    
    case 'create_reminder':
      await executeCreateReminderStep(supabase, step, execution);
      break;
    
    case 'update_status':
      await executeUpdateStatusStep(supabase, step, execution);
      break;
    
    default:
      console.warn(`Unknown action type: ${action_type}`);
  }
}

// Execute send message step
async function executeSendMessageStep(supabase: any, step: any, execution: any) {
  const { action_config } = step;
  const { template_id, channels = ['email'] } = action_config;

  if (!template_id) {
    console.warn('No template_id specified for send message step');
    return;
  }

  // Get trigger entity data for template variables
  const entityData = await getEntityData(supabase, execution.trigger_entity_type, execution.trigger_entity_id);
  
  // Create notification through existing notification system
  const notification = {
    organization_id: execution.workflows.organization_id,
    user_id: entityData.assignee_id || entityData.user_id,
    notification_type: 'workflow-message',
    delivery_method: 'immediate',
    status: 'pending',
    metadata: {
      workflow_id: execution.workflow_id,
      workflow_execution_id: execution.id,
      template_id,
      channels,
      entity_type: execution.trigger_entity_type,
      entity_id: execution.trigger_entity_id,
      entity_data: entityData
    }
  };

  const { error } = await supabase
    .from('notifications')
    .insert(notification);

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  // Trigger notification processing
  await supabase.functions.invoke('notification-processor', {
    body: {
      action: 'process-pending',
      organizationId: execution.workflows.organization_id
    }
  });

  console.log(`Created workflow notification for template ${template_id}`);
}

// Execute create reminder step
async function executeCreateReminderStep(supabase: any, step: any, execution: any) {
  const { action_config } = step;
  const { delay_minutes = 60, content = 'Workflow reminder' } = action_config;

  // Calculate reminder date/time
  const reminderDate = new Date();
  reminderDate.setMinutes(reminderDate.getMinutes() + delay_minutes);

  // Get entity data
  const entityData = await getEntityData(supabase, execution.trigger_entity_type, execution.trigger_entity_id);

  // Create activity/reminder
  const { error } = await supabase
    .from('activities')
    .insert({
      user_id: execution.workflows.user_id,
      organization_id: execution.workflows.organization_id,
      type: 'reminder',
      content: `Workflow Reminder: ${content}`,
      reminder_date: reminderDate.toISOString().split('T')[0],
      reminder_time: reminderDate.toTimeString().split(' ')[0],
      [execution.trigger_entity_type === 'project' ? 'project_id' : 'lead_id']: execution.trigger_entity_id
    });

  if (error) {
    throw new Error(`Failed to create reminder: ${error.message}`);
  }

  console.log(`Created workflow reminder for ${reminderDate.toISOString()}`);
}

// Execute update status step
async function executeUpdateStatusStep(supabase: any, step: any, execution: any) {
  const { action_config } = step;
  const { new_status_id } = action_config;

  if (!new_status_id) {
    console.warn('No new_status_id specified for update status step');
    return;
  }

  const statusField = execution.trigger_entity_type === 'session' ? 'status' : 'status_id';
  const table = execution.trigger_entity_type === 'session' ? 'sessions' : 
                execution.trigger_entity_type === 'project' ? 'projects' : 'leads';

  const { error } = await supabase
    .from(table)
    .update({ [statusField]: new_status_id })
    .eq('id', execution.trigger_entity_id);

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  console.log(`Updated ${execution.trigger_entity_type} status to ${new_status_id}`);
}

// Get entity data for template variables
async function getEntityData(supabase: any, entityType: string, entityId: string) {
  let table = entityType;
  if (entityType === 'session') table = 'sessions';
  else if (entityType === 'project') table = 'projects';
  else if (entityType === 'lead') table = 'leads';

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', entityId)
    .single();

  if (error) {
    console.error(`Error fetching ${entityType} data:`, error);
    return {};
  }

  return data || {};
}

// Evaluate trigger conditions
function evaluateTriggerConditions(conditions: any, triggerData: any): boolean {
  // Simple condition evaluation - can be extended
  if (conditions.status_changed_to) {
    return triggerData.new_status === conditions.status_changed_to;
  }
  
  if (conditions.status_changed_from) {
    return triggerData.old_status === conditions.status_changed_from;
  }

  // Default to true if no specific conditions
  return true;
}

// Evaluate step conditions
function evaluateStepConditions(conditions: any, execution: any): boolean {
  // Simple condition evaluation - can be extended
  // For now, just return true
  return true;
}

// Update execution status
async function updateExecutionStatus(supabase: any, executionId: string, status: string, message?: string) {
  const updates: any = { status };
  
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  
  if (message && status === 'failed') {
    updates.error_message = message;
  }

  await supabase
    .from('workflow_executions')
    .update(updates)
    .eq('id', executionId);
}

serve(handler);