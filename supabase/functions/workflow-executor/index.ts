import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  ensureError,
  getErrorMessage,
} from "../_shared/error-utils.ts";

// Date and time formatting functions
function formatDate(dateString: string, format: string = 'DD/MM/YYYY'): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    default:
      return `${day}/${month}/${year}`; // Default to DD/MM/YYYY
  }
}

function formatTime(timeString: string, format: string = '12-hour'): string {
  if (!timeString) return '';
  
  // Handle different time formats - strip seconds if present
  let hours: number, minutes: number;
  
  if (timeString.includes(':')) {
    const timeParts = timeString.split(':');
    hours = Number(timeParts[0]);
    minutes = Number(timeParts[1]) || 0;
    // Ignore seconds (timeParts[2]) if present
  } else {
    return timeString; // Return as-is if not in expected format
  }
  
  if (format === '24-hour') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } else {
    // Convert to 12-hour format
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}

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

type TriggerWorkflowsFn = typeof triggerWorkflows;
type ExecuteWorkflowStepsFn = typeof executeWorkflowSteps;
type ExecuteWorkflowStepsWithTimeoutFn = typeof executeWorkflowStepsWithTimeout;

export interface WorkflowExecutorDeps {
  createClient: typeof createClient;
  triggerWorkflowsImpl?: TriggerWorkflowsFn;
  executeWorkflowStepsImpl?: ExecuteWorkflowStepsFn;
  executeStepsWithTimeoutImpl?: ExecuteWorkflowStepsWithTimeoutFn;
}

export function createWorkflowExecutor({
  createClient: createClientFn,
  triggerWorkflowsImpl = triggerWorkflows,
  executeWorkflowStepsImpl = executeWorkflowSteps,
  executeStepsWithTimeoutImpl = executeWorkflowStepsWithTimeout
}: WorkflowExecutorDeps) {
  const handler = async (req: Request): Promise<Response> => {
    console.log('Workflow executor started');

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const adminSupabase = createClientFn(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
      const { action, trigger_type, trigger_entity_type, trigger_entity_id, trigger_data, organization_id, workflow_execution_id }: WorkflowTriggerRequest = await req.json();
      console.log(`Processing workflow action: ${action} for trigger: ${trigger_type}`);

      let result;

      switch (action) {
        case 'trigger':
          result = await triggerWorkflowsImpl(adminSupabase, {
            trigger_type,
            trigger_entity_type,
            trigger_entity_id,
            trigger_data,
            organization_id
          }, executeStepsWithTimeoutImpl);
          break;

        case 'execute':
          if (!workflow_execution_id) {
            throw new Error('workflow_execution_id required for execute action');
          }
          result = await executeWorkflowStepsImpl(adminSupabase, workflow_execution_id);
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

    } catch (error: unknown) {
      const resolvedError = ensureError(error);
      console.error('Error in workflow executor:', resolvedError);
      return new Response(JSON.stringify({
        error: resolvedError.message,
        stack: resolvedError.stack,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  };

  return handler;
}

// Find and trigger matching workflows with enhanced duplicate prevention
async function triggerWorkflows(supabase: any, triggerData: {
  trigger_type: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  trigger_data: any;
  organization_id: string;
}, executeStepsRunner: ExecuteWorkflowStepsWithTimeoutFn = executeWorkflowStepsWithTimeout) {
  const { trigger_type, trigger_entity_type, trigger_entity_id, trigger_data, organization_id } = triggerData;
  
  console.log(`Looking for workflows with trigger: ${trigger_type} in org: ${organization_id}`);
  console.log(`Trigger data:`, JSON.stringify(trigger_data));

  let workflowQuery = supabase
    .from('workflows')
    .select('*')
    .eq('trigger_type', trigger_type)
    .eq('organization_id', organization_id)
    .eq('is_active', true);

  const targetedWorkflowIds = new Set<string>();
  const registerWorkflowId = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      targetedWorkflowIds.add(value.trim());
    }
  };

  registerWorkflowId(trigger_data?.workflow_id);
  if (Array.isArray(trigger_data?.workflow_ids)) {
    for (const value of trigger_data.workflow_ids) {
      registerWorkflowId(value);
    }
  }

  if (targetedWorkflowIds.size > 0) {
    const ids = Array.from(targetedWorkflowIds);
    console.log(`Executing specific workflow set: ${ids.join(', ')}`);
    workflowQuery = workflowQuery.in('id', ids);
  }

  const { data: workflows, error: workflowsError } = await workflowQuery;

  if (workflowsError) {
    console.error('Error fetching workflows:', workflowsError);
    throw workflowsError;
  }

  if (!workflows || workflows.length === 0) {
    console.log(`No active workflows found for trigger: ${trigger_type}`);
    return { triggered_workflows: 0 };
  }

  console.log(`Found ${workflows.length} matching workflows`);

  const shouldHandleSessionScheduling = trigger_type === 'session_scheduled' && trigger_entity_type === 'session';
  const skipReminders =
    shouldHandleSessionScheduling &&
    (trigger_data?.skip_reminders === true || trigger_data?.notifications?.sendReminder === false);

  // Special handling for session_scheduled trigger - schedule future reminders
  if (shouldHandleSessionScheduling && !skipReminders) {
    try {
      console.log(`Scheduling session reminders for session: ${trigger_entity_id}`);
      const { error: schedulingError } = await supabase.rpc('schedule_session_reminders', {
        session_id_param: trigger_entity_id
      });
      
      if (schedulingError) {
        console.error('Error scheduling session reminders:', schedulingError);
        // Don't throw - continue with workflow execution even if scheduling fails
      } else {
        console.log(`Successfully scheduled reminders for session: ${trigger_entity_id}`);
      }
    } catch (error) {
      console.error('Failed to schedule session reminders:', error);
      // Don't throw - continue with workflow execution
    }
  } else if (shouldHandleSessionScheduling && skipReminders) {
    console.log(`Skipping reminder scheduling for session ${trigger_entity_id} due to client preference.`);
  }

  const executions = [];
  const duplicateFingerprints = new Set();
  const forceTriggerExecution = targetedWorkflowIds.size > 0;

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

      // Create fingerprint for duplicate detection
      const fingerprint = `${workflow.id}_${trigger_entity_type}_${trigger_entity_id}_${JSON.stringify(trigger_data?.status_change || '')}_${JSON.stringify(trigger_data?.date_change || '')}_${JSON.stringify(trigger_data?.reminder_type || '')}`;
      
      if (!forceTriggerExecution) {
        if (duplicateFingerprints.has(fingerprint)) {
          console.log(`Skipping workflow ${workflow.id}: Duplicate execution detected in this batch`);
          continue;
        }
        duplicateFingerprints.add(fingerprint);
      }

      // Enhanced duplicate check: Check for recent executions (within last 60 seconds for same trigger data)
      const recentCutoff = new Date(Date.now() - 60000).toISOString();
      const { data: recentExecutions, error: duplicateCheckError } = await supabase
        .from('workflow_executions')
        .select('id, execution_log')
        .eq('workflow_id', workflow.id)
        .eq('trigger_entity_type', trigger_entity_type)
        .eq('trigger_entity_id', trigger_entity_id)
        .gte('created_at', recentCutoff)
        .in('status', ['pending', 'running', 'completed']);

      if (duplicateCheckError) {
        console.error('Error checking for duplicates:', duplicateCheckError);
      } else if (!forceTriggerExecution && recentExecutions && recentExecutions.length > 0) {
        // Check if any recent execution has the same trigger data
        const recentExecutionRecords = (recentExecutions as Array<{
          execution_log?: Array<{
            trigger_data?: {
              status_change?: unknown;
              date_change?: unknown;
              reminder_type?: unknown;
            };
          }>;
        }>);
        const triggerDataRecord = trigger_data as {
          status_change?: unknown;
          date_change?: unknown;
          reminder_type?: unknown;
        } | undefined;

        const isDuplicate = recentExecutionRecords.some((execution) => {
          const execTriggerData = execution.execution_log?.[0]?.trigger_data;
          if (!execTriggerData && !triggerDataRecord) return true;
          if (!execTriggerData || !triggerDataRecord) return false;

          // Compare relevant trigger data fields
          return (
            execTriggerData.status_change === triggerDataRecord.status_change &&
            execTriggerData.date_change === triggerDataRecord.date_change &&
            execTriggerData.reminder_type === triggerDataRecord.reminder_type
          );
        });
        
        if (isDuplicate) {
          console.log(`Skipping workflow ${workflow.id}: Recent execution found with same trigger data`);
          continue;
        }
      }

      // Create workflow execution record with enhanced logging
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
            trigger_data,
            fingerprint
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

      // Execute workflow steps asynchronously with timeout monitoring
      executeStepsRunner(supabase, execution.id).catch(error => {
        console.error(`Error executing workflow ${workflow.id}:`, error);
      });

    } catch (error) {
      console.error(`Error processing workflow ${workflow.id}:`, error);
    }
  }

  return { triggered_workflows: executions.length, executions };
}

// Enhanced workflow execution with timeout monitoring
async function executeWorkflowStepsWithTimeout(supabase: any, executionId: string) {
  const EXECUTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Workflow execution timed out after 5 minutes'));
    }, EXECUTION_TIMEOUT);
  });

  try {
    await Promise.race([
      executeWorkflowSteps(supabase, executionId),
      timeoutPromise
    ]);
  } catch (error: unknown) {
    const resolvedError = ensureError(error);
    console.error(`Workflow execution ${executionId} failed or timed out:`, resolvedError);
    await updateExecutionStatus(supabase, executionId, 'failed', resolvedError.message);
    throw resolvedError;
  }
}

// Execute workflow steps with enhanced error handling and retry logic
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

  // Check if execution is already completed or failed
  if (execution.status === 'completed' || execution.status === 'failed') {
    console.log(`Execution ${executionId} already ${execution.status}, skipping`);
    return { executed_steps: 0 };
  }

  // Update execution status to running with heartbeat
  await supabase
    .from('workflow_executions')
    .update({ 
      status: 'running',
      started_at: new Date().toISOString()
    })
    .eq('id', executionId);

  let executedSteps = 0;
  let failedSteps = 0;

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

    // Execute steps in order with enhanced error handling
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        // Apply delay if specified (for subsequent steps)
        if (i > 0 && step.delay_minutes && step.delay_minutes > 0) {
          console.log(`Applying delay of ${step.delay_minutes} minutes for step ${step.id}`);
          // In production, you might want to implement proper scheduling here
          // For now, we continue immediately but log the intended delay
        }

        // Check step conditions if they exist
        if (step.conditions && Object.keys(step.conditions).length > 0) {
          const conditionsMet = evaluateStepConditions(step.conditions, execution);
          if (!conditionsMet) {
            console.log(`Skipping step ${step.id}: conditions not met`);
            
            // Log step skipped
            const currentLog = execution.execution_log || [];
            currentLog.push({
              timestamp: new Date().toISOString(),
              action: 'step_skipped',
              step_id: step.id,
              step_order: step.step_order,
              details: 'Step conditions not met'
            });

            await supabase
              .from('workflow_executions')
              .update({ execution_log: currentLog })
              .eq('id', executionId);
            
            continue;
          }
        }

        // Execute the step with retry logic
        await executeWorkflowStepWithRetry(supabase, executionId, step, execution);
        executedSteps++;

        // Log step execution success
        const currentLog = execution.execution_log || [];
        currentLog.push({
          timestamp: new Date().toISOString(),
          action: 'step_executed',
          step_id: step.id,
          step_order: step.step_order,
          action_type: step.action_type,
          details: `Successfully executed ${step.action_type} step`
        });

        await supabase
          .from('workflow_executions')
          .update({ execution_log: currentLog })
          .eq('id', executionId);

      } catch (stepError: unknown) {
        const resolvedStepError = ensureError(stepError);
        console.error(`Error executing step ${step.id}:`, resolvedStepError);
        failedSteps++;
        
        // Log step error with more detail
        const currentLog = execution.execution_log || [];
        currentLog.push({
          timestamp: new Date().toISOString(),
          action: 'step_failed',
          step_id: step.id,
          step_order: step.step_order,
          action_type: step.action_type,
          error: resolvedStepError.message,
          error_stack: resolvedStepError.stack,
          details: `Failed to execute ${step.action_type} step`
        });

        await supabase
          .from('workflow_executions')
          .update({ execution_log: currentLog })
          .eq('id', executionId);

        // Continue with next step (resilient execution)
        console.log(`Continuing with remaining steps despite step ${step.id} failure`);
      }
    }

    // Determine final status based on step results
    const finalStatus = failedSteps === 0 ? 'completed' : (executedSteps > 0 ? 'completed' : 'failed');
    const statusMessage = `Executed ${executedSteps}/${steps.length} steps successfully${failedSteps > 0 ? `, ${failedSteps} failed` : ''}`;
    
    await updateExecutionStatus(supabase, executionId, finalStatus, statusMessage);
    
    return { 
      executed_steps: executedSteps, 
      failed_steps: failedSteps,
      total_steps: steps.length,
      success_rate: steps.length > 0 ? (executedSteps / steps.length) * 100 : 0
    };

  } catch (error: unknown) {
    const resolvedError = ensureError(error);
    console.error(`Critical error executing workflow ${executionId}:`, resolvedError);
    await updateExecutionStatus(
      supabase,
      executionId,
      'failed',
      `Critical failure: ${resolvedError.message}`,
    );
    throw resolvedError;
  }
}

// Execute individual workflow step with retry logic
async function executeWorkflowStepWithRetry(supabase: any, executionId: string, step: any, execution: any, maxRetries: number = 2) {
  let lastError: Error | undefined;
  
  for (let retry = 0; retry <= maxRetries; retry++) {
    try {
      if (retry > 0) {
        console.log(`Retrying step ${step.id}, attempt ${retry + 1}/${maxRetries + 1}`);
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retry));
      }
      
      await executeWorkflowStep(supabase, executionId, step, execution);
      
      if (retry > 0) {
        console.log(`Step ${step.id} succeeded on retry attempt ${retry + 1}`);
      }
      
      return; // Success
      
    } catch (error: unknown) {
      const resolvedError = ensureError(error);
      lastError = resolvedError;
      console.error(`Step ${step.id} failed on attempt ${retry + 1}:`, resolvedError.message);
      
      // Don't retry certain types of errors (validation, authentication, etc.)
      const errorMessage = resolvedError.message;
      if (
        errorMessage.includes('authentication') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('validation') ||
        errorMessage.includes('not found')
      ) {
        console.log(`Step ${step.id} failed with non-retryable error, not retrying`);
        throw resolvedError;
      }
    }
  }
  
  // All retries exhausted
  const finalErrorMessage = lastError ? lastError.message : 'Unknown error';
  throw new Error(`Step failed after ${maxRetries + 1} attempts. Last error: ${finalErrorMessage}`);
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

  console.log(`Executing send message step with template ${template_id}`);

  // Get trigger entity data for template variables - pass trigger_data for consistency
  const triggerData = execution.execution_log?.[0]?.trigger_data;
  const entityData = await getEntityData(supabase, execution.trigger_entity_type, execution.trigger_entity_id, triggerData);
  
  console.log('Entity data for workflow:', entityData);

  // Check if we have a client email to send to
  const clientEmail = entityData.client_email || entityData.customer_email;
  if (!clientEmail) {
    console.log('No client email found, skipping workflow execution');
    return; // Skip if no client email
  }

  console.log(`Sending workflow message to client: ${clientEmail}`);

  // Get organization settings for business info and date formatting
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('photography_business_name, date_format, time_format, primary_brand_color')
    .eq('organization_id', execution.workflows.organization_id)
    .single();

  // Format dates according to organization preferences
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const dateFormat = orgSettings?.date_format || 'DD/MM/YYYY';
    
    switch (dateFormat) {
      case 'MM/DD/YYYY':
        return date.toLocaleDateString('en-US');
      case 'DD/MM/YYYY':
        return date.toLocaleDateString('en-GB');
      case 'YYYY-MM-DD':
        return date.toISOString().split('T')[0];
      case 'DD-MM-YYYY':
        return date.toLocaleDateString('en-GB').replace(/\//g, '-');
      case 'MM-DD-YYYY':
        return date.toLocaleDateString('en-US').replace(/\//g, '-');
      default:
        return date.toLocaleDateString('en-GB');
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const timeFormat = orgSettings?.time_format || '12-hour';
    
    if (timeFormat === '24-hour') {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
  };

  console.log('Workflow email - Mock data keys:', Object.keys(entityData));
  console.log('Workflow email - Mock data values:', {
    customer_name: entityData.customer_name || entityData.name || entityData.leads?.name || 'Client',
    lead_name: entityData.customer_name || entityData.name || entityData.leads?.name || 'Client',
    lead_email: entityData.customer_email || entityData.email || entityData.leads?.email || clientEmail,
    lead_phone: entityData.customer_phone || entityData.phone || entityData.leads?.phone || '-',
    
    // Session info with proper formatting using org settings
    session_date: formatDate(entityData.session_date || entityData.date),
    session_time: formatTime(entityData.session_time || entityData.time),
    session_location: (entityData.location && entityData.location.trim() !== '' && entityData.location !== 'Studio') ? entityData.location : '-', // Use dash for empty/null/Studio location
    session_notes: entityData.notes || entityData.session_notes || '',
    
    // Project info
    project_name: entityData.project_name || entityData.projects?.name || '',
    project_type: entityData.project_type || '',
    
    // Business info from organization settings
    business_name: orgSettings?.photography_business_name || 'Your Business',
    studio_name: orgSettings?.photography_business_name || 'Your Business',
    
    // Additional fallback mappings for common template variables
    client_name: entityData.customer_name || entityData.name || entityData.leads?.name || 'Client',
    client_email: entityData.customer_email || entityData.email || entityData.leads?.email || clientEmail,
    customer_email: entityData.customer_email || entityData.email || entityData.leads?.email || clientEmail,
    
    // Add all entity data for template flexibility (but don't override above mappings)
    ...entityData
  });

  // Try to use send-template-email function first
  try {
    const { data, error } = await supabase.functions.invoke('send-template-email', {
      body: {
        template_id,
        recipient_email: clientEmail,
        recipient_name: entityData.customer_name || 'Client',
        mockData: {
          // Customer/Lead info - Use fallback properties to ensure {lead_name} gets replaced
          customer_name: entityData.customer_name || entityData.name || entityData.leads?.name || 'Client',
          lead_name: entityData.customer_name || entityData.name || entityData.leads?.name || 'Client',
          lead_email: entityData.customer_email || entityData.email || entityData.leads?.email || clientEmail,
          lead_phone: entityData.customer_phone || entityData.phone || entityData.leads?.phone || '-',
          
          // Session info with proper formatting using org settings
          session_date: formatDate(entityData.session_date || entityData.date),
          session_time: formatTime(entityData.session_time || entityData.time),
          session_location: (entityData.location && entityData.location.trim() !== '' && entityData.location !== 'Studio') ? entityData.location : '-', // Use dash for empty/null/Studio location
          session_notes: entityData.notes || entityData.session_notes || '',
          
          // Project info
          project_name: entityData.project_name || entityData.projects?.name || '',
          project_type: entityData.project_type || '',
          
          // Business info from organization settings
          business_name: orgSettings?.photography_business_name || 'Your Business',
          studio_name: orgSettings?.photography_business_name || 'Your Business',
          
          // Additional fallback mappings for common template variables
          client_name: entityData.customer_name || entityData.name || entityData.leads?.name || 'Client',
          client_email: entityData.customer_email || entityData.email || entityData.leads?.email || clientEmail,
          customer_email: entityData.customer_email || entityData.email || entityData.leads?.email || clientEmail,
          
          // Add all entity data for template flexibility (but don't override above mappings)
          ...entityData
        },
        workflow_execution_id: execution.id
      }
    });

    if (error) {
      console.error('Error sending workflow email via send-template-email:', error);
      throw error;
    }

    console.log('Successfully sent workflow email to client via send-template-email');
  } catch (error) {
    console.error('Failed to send via send-template-email, falling back to notification system:', error);
    
    // Fallback: Create notification record for processing
    const notification = {
      organization_id: execution.workflows.organization_id,
      user_id: execution.workflows.user_id,
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
        entity_data: entityData,
        client_email: clientEmail,
        client_name: entityData.customer_name || 'Client'
      }
    };

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notification);

    if (notificationError) {
      console.error('Error creating fallback notification:', notificationError);
      throw notificationError;
    }

    // Trigger notification processing
    try {
      await supabase.functions.invoke('notification-processor', {
        body: {
          action: 'process-pending',
          organizationId: execution.workflows.organization_id
        }
      });
      console.log('Successfully triggered notification processor');
    } catch (processorError) {
      console.error('Error triggering notification processor:', processorError);
    }
  }
}

// Execute create reminder step
async function executeCreateReminderStep(supabase: any, step: any, execution: any) {
  const { action_config } = step;
  const { delay_minutes = 60, content = 'Workflow reminder' } = action_config;

  // Calculate reminder date/time
  const reminderDate = new Date();
  reminderDate.setMinutes(reminderDate.getMinutes() + delay_minutes);

  // Get entity data
  const triggerData = execution.execution_log?.[0]?.trigger_data;
  const entityData = await getEntityData(supabase, execution.trigger_entity_type, execution.trigger_entity_id, triggerData);

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
    throw new Error(`Failed to create reminder: ${getErrorMessage(error)}`);
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
    throw new Error(`Failed to update status: ${getErrorMessage(error)}`);
  }

  console.log(`Updated ${execution.trigger_entity_type} status to ${new_status_id}`);
}

// Get entity data for template variables
async function getEntityData(supabase: any, entityType: string, entityId: string, triggerData?: any) {
  let entityData: any = {};
  
  if (entityType === 'session') {
    // If we have session data from trigger (e.g., from reminder processing), use it first for consistency
    if (triggerData?.session_data && triggerData?.lead_data) {
      console.log('Using session data from trigger_data to ensure consistency');
      console.log('Trigger session data:', triggerData.session_data);
      console.log('Trigger lead data:', triggerData.lead_data);
      
      // Validate that the session ID matches what we expect
      if (triggerData.debug_session_validation) {
        console.log('Session validation:', triggerData.debug_session_validation);
        if (triggerData.debug_session_validation.expected_session_id !== entityId) {
          console.error(`❌ CRITICAL SESSION ID MISMATCH!`);
          console.error(`Expected session: ${triggerData.debug_session_validation.expected_session_id}`);
          console.error(`Received entity: ${entityId}`);  
          console.error(`Reminder type: ${triggerData.debug_session_validation.reminder_type}`);
          console.error(`This would cause wrong session notifications!`);
          throw new Error(`Session ID mismatch: Expected ${triggerData.debug_session_validation.expected_session_id} but got ${entityId} for ${triggerData.debug_session_validation.reminder_type}`);
        }
        
        console.log(`✅ Session validation passed for ${triggerData.debug_session_validation.reminder_type}`);
        console.log(`Processing session: ${entityId} (${triggerData.session_data.session_date} ${triggerData.session_data.session_time})`);
      }
      
      entityData = {
        session_date: triggerData.session_data.session_date,
        session_time: triggerData.session_data.session_time,
        location: triggerData.session_data.location,
        notes: triggerData.session_data.notes,
        customer_name: triggerData.lead_data.name,
        customer_email: triggerData.lead_data.email,
        customer_phone: triggerData.lead_data.phone || '-',
        client_email: triggerData.lead_data.email,
        // Add all trigger data
        ...triggerData.session_data,
        ...triggerData.lead_data,
        // Map lead data to expected field names
        leads: {
          name: triggerData.lead_data.name,
          email: triggerData.lead_data.email,
          phone: triggerData.lead_data.phone
        }
      };
      
      console.log('Final entity data from trigger:', entityData);
      return entityData;
    }

    // Fallback to database query if no trigger data available
    console.log('No trigger data available, querying database for session:', entityId);
    const { data: session } = await supabase
      .from('sessions')
      .select(`
        *,
        session_types:session_type_id (
          id,
          name,
          duration_minutes
        ),
        leads:lead_id (
          id,
          name,
          email,
          phone,
          organization_id
        ),
        projects:project_id (
          name,
          description,
          project_types (
            name
          )
        )
      `)
      .eq('id', entityId)
      .single();

    // Get lead field values if we have a lead
    let leadFieldValues = {};
    if (session?.leads?.id) {
      const { data: fieldValues } = await supabase
        .from('lead_field_values')
        .select('field_key, value')
        .eq('lead_id', session.leads.id);
      
      if (fieldValues) {
        leadFieldValues = fieldValues.reduce((acc: any, fv: any) => {
          acc[`lead_${fv.field_key}`] = fv.value || '-';
          return acc;
        }, {});
      }
    }
    
    entityData = {
      session_date: session?.session_date,
      session_time: session?.session_time,
      location: session?.location,
      notes: session?.notes,
      customer_name: session?.leads?.name,
      customer_email: session?.leads?.email,
      customer_phone: session?.leads?.phone || '-',
      project_name: session?.projects?.name,
      project_type: session?.projects?.project_types?.name || '',
      client_email: session?.leads?.email,
      session_type_id: session?.session_type_id ?? null,
      session_type_name: session?.session_types?.name ?? null,
      session_type_duration_minutes: session?.session_types?.duration_minutes ?? null,
      ...leadFieldValues,
      ...session
    };
  } else if (entityType === 'project') {
    const { data: project } = await supabase
      .from('projects')
      .select(`
        *,
        leads:lead_id (
          id,
          name,
          email,
          phone,
          organization_id
        ),
        project_types (
          name
        )
      `)
      .eq('id', entityId)
      .single();

    // Get lead field values if we have a lead
    let leadFieldValues = {};
    if (project?.leads?.id) {
      const { data: fieldValues } = await supabase
        .from('lead_field_values')
        .select('field_key, value')
        .eq('lead_id', project.leads.id);
      
      if (fieldValues) {
        leadFieldValues = fieldValues.reduce((acc: any, fv: any) => {
          acc[`lead_${fv.field_key}`] = fv.value || '-';
          return acc;
        }, {});
      }
    }
    
    entityData = {
      project_name: project?.name,
      project_type: project?.project_types?.name || '',
      customer_name: project?.leads?.name,
      customer_email: project?.leads?.email,
      customer_phone: project?.leads?.phone || '-',
      client_email: project?.leads?.email,
      ...leadFieldValues,
      ...project
    };
  } else if (entityType === 'lead') {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', entityId)
      .single();

    // Get lead field values
    let leadFieldValues = {};
    if (lead?.id) {
      const { data: fieldValues } = await supabase
        .from('lead_field_values')
        .select('field_key, value')
        .eq('lead_id', lead.id);
      
      if (fieldValues) {
        leadFieldValues = fieldValues.reduce((acc: any, fv: any) => {
          acc[`lead_${fv.field_key}`] = fv.value || '-';
          return acc;
        }, {});
      }
    }
    
    entityData = {
      customer_name: lead?.name,
      customer_email: lead?.email,
      customer_phone: lead?.phone || '-',
      client_email: lead?.email,
      ...leadFieldValues,
      ...lead
    };
  }
  
  return entityData;
}

// Evaluate trigger conditions
function evaluateTriggerConditions(conditions: any, triggerData: any): boolean {
  console.log(`Evaluating conditions:`, JSON.stringify(conditions));
  console.log(`Against trigger data:`, JSON.stringify(triggerData));
  
  // Simple condition evaluation - can be extended
  if (conditions.status_changed_to) {
    const result = triggerData.new_status === conditions.status_changed_to;
    console.log(`Status changed to condition: ${result}`);
    return result;
  }
  
  if (conditions.status_changed_from) {
    const result = triggerData.old_status === conditions.status_changed_from;
    console.log(`Status changed from condition: ${result}`);
    return result;
  }

  // Session reminder conditions - CRITICAL FIX: Strict matching
  if (conditions.reminder_type) {
    const result = triggerData.reminder_type === conditions.reminder_type;
    console.log(`Reminder type condition (${conditions.reminder_type} === ${triggerData.reminder_type}): ${result}`);
    return result;
  }

  if (conditions.reminder_days !== undefined) {
    const result = triggerData.reminder_days === conditions.reminder_days;
    console.log(`Reminder days condition (${conditions.reminder_days} === ${triggerData.reminder_days}): ${result}`);
    return result;
  }

  if (conditions.reminder_hours !== undefined) {
    const result = triggerData.reminder_hours === conditions.reminder_hours;
    console.log(`Reminder hours condition (${conditions.reminder_hours} === ${triggerData.reminder_hours}): ${result}`);
    return result;
  }

  // Default to true if no specific conditions
  console.log(`No specific conditions found, defaulting to true`);
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

const handler = createWorkflowExecutor({ createClient });

serve(handler);

export {
  evaluateTriggerConditions,
  executeWorkflowSteps,
  executeWorkflowStepsWithTimeout,
  formatDate,
  formatTime,
  triggerWorkflows,
  updateExecutionStatus,
};
