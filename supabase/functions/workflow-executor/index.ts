import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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

const formatDurationFromMinutes = (minutes?: number | null): string => {
  if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) {
    return '';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes}m`);
  }

  return parts.join(' ') || `${minutes}m`;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRecord = Record<string, unknown>;

type GenericSupabaseClient = SupabaseClient<unknown, unknown, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

interface WorkflowTriggerInput {
  trigger_type: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  trigger_data?: JsonRecord;
  organization_id: string;
}

interface WorkflowRecord {
  id: string;
  trigger_conditions?: JsonRecord | null;
  organization_id: string;
  user_id: string;
  name?: string | null;
}

interface WorkflowExecutionLogEntry extends JsonRecord {
  timestamp: string;
  action: string;
}

interface WorkflowExecutionRecord {
  id: string;
  workflow_id: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  status: string;
  execution_log?: WorkflowExecutionLogEntry[] | null;
  workflows: WorkflowRecord;
}

interface WorkflowExecutionInsertResult {
  id: string;
  execution_log?: WorkflowExecutionLogEntry[] | null;
}

interface WorkflowExecutionLogRow extends JsonRecord {
  trigger_data?: JsonRecord;
}

interface WorkflowExecutionCheckRow {
  id: string;
  execution_log?: WorkflowExecutionLogRow[] | null;
}

interface WorkflowStepRecord {
  id: string;
  workflow_id: string;
  step_order: number;
  action_type: string;
  action_config: JsonRecord;
  delay_minutes?: number | null;
  conditions?: JsonRecord | null;
}

interface OrganizationPreferences {
  photography_business_name?: string | null;
  date_format?: string | null;
  time_format?: string | null;
  primary_brand_color?: string | null;
}

interface LeadFieldValue {
  field_key: string;
  value: string | null;
}

interface LeadRecord {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  organization_id?: string | null;
  [key: string]: unknown;
}

interface SessionRecord {
  id: string;
  session_name?: string | null;
  session_date?: string | null;
  session_time?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: string | null;
  meeting_url?: string | null;
  session_type_id?: string | null;
  session_types?: {
    id?: string;
    name?: string | null;
    duration_minutes?: number | null;
  } | null;
  leads?: LeadRecord | null;
  projects?: {
    name?: string | null;
    description?: string | null;
    package_snapshot?: JsonRecord | null;
    project_types?: {
      name?: string | null;
    } | null;
  } | null;
  [key: string]: unknown;
}

interface ProjectRecord {
  id: string;
  name?: string | null;
  description?: string | null;
  package_snapshot?: JsonRecord | null;
  project_types?: {
    name?: string | null;
  } | null;
  leads?: LeadRecord | null;
  [key: string]: unknown;
}

interface SessionScheduleRow {
  session_date?: string | null;
  session_time?: string | null;
  organization_id?: string | null;
}

interface OrganizationTimezoneRow {
  timezone?: string | null;
}

type EntityData = JsonRecord & {
  client_email?: string;
  customer_email?: string;
  customer_name?: string;
  name?: string;
  location?: string;
  notes?: string;
  session_date?: string;
  session_time?: string;
  session_name?: string;
  status?: string;
  session_type_name?: string | null;
  session_type_duration_minutes?: number | null;
  project_package_name?: string;
  meeting_url?: string;
  project_name?: string;
  project_type?: string;
  leads?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  projects?: {
    name?: string | null;
    package_snapshot?: JsonRecord | null;
    project_types?: {
      name?: string | null;
    } | null;
  } | null;
  session_types?: {
    name?: string | null;
    duration_minutes?: number | null;
  } | null;
};

const getString = (record: JsonRecord, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumber = (record: JsonRecord, key: string): number | undefined => {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
};

const getBoolean = (record: JsonRecord, key: string): boolean | undefined => {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
};

const getZonedDateParts = (timeZone: string) => {
  const now = new Date();

  return {
    date: new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now),
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now)
  };
};

const normalizeSessionTime = (timeValue?: string | null): string | null => {
  if (typeof timeValue !== 'string') return null;
  const trimmed = timeValue.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : null;
};

async function isSessionInPast(
  supabase: GenericSupabaseClient,
  sessionId: string
): Promise<boolean> {
  try {
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('session_date, session_time, organization_id')
      .eq('id', sessionId)
      .maybeSingle<SessionScheduleRow>();

    if (sessionError) {
      console.error('Error fetching session for past-date guard:', sessionError);
      return false;
    }

    if (!session || typeof session.session_date !== 'string') {
      console.log(`Session ${sessionId} not found or missing date; skipping past-date guard`);
      return false;
    }

    const { data: orgSettings, error: timezoneError } = await supabase
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', session.organization_id)
      .maybeSingle<OrganizationTimezoneRow>();

    if (timezoneError) {
      console.error('Error fetching organization timezone for past-date guard:', timezoneError);
    }

    const timeZone = orgSettings?.timezone || 'UTC';
    const { date: todayDate, time: currentTime } = getZonedDateParts(timeZone);
    const normalizedSessionTime = normalizeSessionTime(session.session_time);

    if (session.session_date < todayDate) {
      return true;
    }

    if (session.session_date > todayDate || !normalizedSessionTime) {
      return false;
    }

    return normalizedSessionTime < currentTime;
  } catch (error) {
    console.error('Failed to evaluate session schedule for past-date guard:', error);
    return false;
  }
}

interface WorkflowTriggerRequest {
  action: 'trigger' | 'execute';
  trigger_type: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  trigger_data?: JsonRecord;
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
    ) as GenericSupabaseClient;

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
async function triggerWorkflows(
  supabase: GenericSupabaseClient,
  triggerData: WorkflowTriggerInput,
  executeStepsRunner: ExecuteWorkflowStepsWithTimeoutFn = executeWorkflowStepsWithTimeout
) {
  const { trigger_type, trigger_entity_type, trigger_entity_id, trigger_data, organization_id } = triggerData;
  const triggerPayload = trigger_data ?? {};
  
  console.log(`Looking for workflows with trigger: ${trigger_type} in org: ${organization_id}`);
  console.log(`Trigger data:`, JSON.stringify(trigger_data));

  let workflowQuery = supabase
    .from('workflows')
    .select('id, trigger_conditions, organization_id, user_id, name')
    .eq('trigger_type', trigger_type)
    .eq('organization_id', organization_id)
    .eq('is_active', true);

  const targetedWorkflowIds = new Set<string>();
  const registerWorkflowId = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      targetedWorkflowIds.add(value.trim());
    }
  };

  registerWorkflowId(triggerPayload.workflow_id);
  const workflowIdsValue = triggerPayload.workflow_ids;
  if (Array.isArray(workflowIdsValue)) {
    for (const value of workflowIdsValue) {
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
  if (shouldHandleSessionScheduling) {
    const sessionIsInPast = await isSessionInPast(supabase, trigger_entity_id);
    if (sessionIsInPast) {
      console.log(`Skipping session_scheduled automations for past session ${trigger_entity_id}`);
      return { triggered_workflows: 0, skipped: 'session_in_past' };
    }
  }

  const skipReminders =
    shouldHandleSessionScheduling &&
    (triggerPayload.skip_reminders === true || (isJsonRecord(triggerPayload.notifications) && triggerPayload.notifications.sendReminder === false));

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

  const executions: WorkflowExecutionInsertResult[] = [];
  const duplicateFingerprints = new Set<string>();
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
        .in('status', ['pending', 'running', 'completed'])
        ;

      if (duplicateCheckError) {
        console.error('Error checking for duplicates:', duplicateCheckError);
      } else if (!forceTriggerExecution && recentExecutions && recentExecutions.length > 0) {
        const serialize = (value: unknown) => JSON.stringify(value ?? null);
        const triggerStatusChange = triggerPayload['status_change'];
        const triggerDateChange = triggerPayload['date_change'];
        const triggerReminderType = triggerPayload['reminder_type'];

        const isDuplicate = recentExecutions.some((executionRow) => {
          const execTriggerData = executionRow.execution_log?.[0]?.trigger_data ?? {};
          if (!isJsonRecord(execTriggerData)) {
            return false;
          }

          return (
            serialize(execTriggerData.status_change) === serialize(triggerStatusChange) &&
            serialize(execTriggerData.date_change) === serialize(triggerDateChange) &&
            serialize(execTriggerData.reminder_type) === serialize(triggerReminderType)
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
        .single<WorkflowExecutionInsertResult>();

      if (executionError) {
        console.error(`Error creating execution for workflow ${workflow.id}:`, executionError);
        continue;
      }

      if (execution) {
        executions.push(execution);
      }
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
async function executeWorkflowStepsWithTimeout(supabase: GenericSupabaseClient, executionId: string) {
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
async function executeWorkflowSteps(supabase: GenericSupabaseClient, executionId: string) {
  console.log(`Executing workflow steps for execution: ${executionId}`);

  // Get execution and workflow details
  const { data: execution, error: executionError } = await supabase
    .from('workflow_executions')
    .select(`
      *,
      workflows:workflow_id (*)
    `)
    .eq('id', executionId)
    .single<WorkflowExecutionRecord>();

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
      .order('step_order')
      ;

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
async function executeWorkflowStepWithRetry(
  supabase: GenericSupabaseClient,
  executionId: string,
  step: WorkflowStepRecord,
  execution: WorkflowExecutionRecord,
  maxRetries: number = 2
) {
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
async function executeWorkflowStep(
  supabase: GenericSupabaseClient,
  executionId: string,
  step: WorkflowStepRecord,
  execution: WorkflowExecutionRecord
) {
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
async function executeSendMessageStep(
  supabase: GenericSupabaseClient,
  step: WorkflowStepRecord,
  execution: WorkflowExecutionRecord
) {
  const config = step.action_config;
  const templateId = getString(config, 'template_id');
  const channelsValue = config['channels'];
  const channels = Array.isArray(channelsValue)
    ? channelsValue.filter((channel): channel is string => typeof channel === 'string')
    : ['email'];

  if (!templateId) {
    console.warn('No template_id specified for send message step');
    return;
  }

  console.log(`Executing send message step with template ${templateId}`);

  // Get trigger entity data for template variables - pass trigger_data for consistency
  const triggerData = execution.execution_log?.[0]?.trigger_data;
  const entityData = await getEntityData(supabase, execution.trigger_entity_type, execution.trigger_entity_id, triggerData);
  
  console.log('Entity data for workflow:', entityData);

  // Check if we have a client email to send to
  const clientEmail = typeof entityData.client_email === 'string'
    ? entityData.client_email
    : typeof entityData.customer_email === 'string'
      ? entityData.customer_email
      : undefined;
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
    .single<OrganizationPreferences>();

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
  const resolvedCustomerName = typeof entityData.customer_name === 'string'
    ? entityData.customer_name
    : typeof entityData.name === 'string'
      ? entityData.name
      : typeof entityData.leads?.name === 'string'
        ? entityData.leads.name
        : 'Client';
  const resolvedCustomerEmail = typeof entityData.customer_email === 'string'
    ? entityData.customer_email
    : typeof entityData.email === 'string'
      ? entityData.email
      : typeof entityData.leads?.email === 'string'
        ? entityData.leads.email
        : clientEmail;
  const resolvedCustomerPhone = typeof entityData.customer_phone === 'string'
    ? entityData.customer_phone
    : typeof entityData.phone === 'string'
      ? entityData.phone
      : typeof entityData.leads?.phone === 'string'
        ? entityData.leads.phone
        : '-';

  const formattedSessionDate = formatDate(
    typeof entityData.session_date === 'string'
      ? entityData.session_date
      : (typeof entityData.date === 'string' ? entityData.date : '')
  );
  const formattedSessionTime = formatTime(
    typeof entityData.session_time === 'string'
      ? entityData.session_time
      : (typeof entityData.time === 'string' ? entityData.time : '')
  );
  const resolvedSessionLocation = (() => {
    const locationValue = typeof entityData.location === 'string' ? entityData.location : '';
    return locationValue && locationValue.trim() !== '' && locationValue !== 'Studio' ? locationValue : '-';
  })();
  const resolvedSessionNotes = typeof entityData.notes === 'string'
    ? entityData.notes
    : typeof entityData.session_notes === 'string'
      ? entityData.session_notes
      : '';
  const resolvedSessionName = typeof entityData.session_name === 'string' ? entityData.session_name : '';
  const resolvedSessionStatus = typeof entityData.status === 'string' ? entityData.status : '';
  const resolvedSessionType = typeof entityData.session_type_name === 'string'
    ? entityData.session_type_name
    : typeof entityData.session_types?.name === 'string'
      ? entityData.session_types.name
      : '';
  const resolvedSessionDuration = formatDurationFromMinutes(
    typeof entityData.session_type_duration_minutes === 'number'
      ? entityData.session_type_duration_minutes
      : typeof (entityData as { duration_minutes?: number }).duration_minutes === 'number'
        ? (entityData as { duration_minutes?: number }).duration_minutes
        : undefined
  );
  const resolvedMeetingUrl = typeof entityData.meeting_url === 'string'
    ? entityData.meeting_url
    : typeof (entityData as { meetingUrl?: string }).meetingUrl === 'string'
      ? (entityData as { meetingUrl?: string }).meetingUrl
      : '';
  const resolvedProjectName = typeof entityData.project_name === 'string'
    ? entityData.project_name
    : typeof entityData.projects?.name === 'string'
      ? entityData.projects.name
      : '';
  const resolvedProjectPackage = typeof entityData.project_package_name === 'string'
    ? entityData.project_package_name
    : (() => {
        const snapshot = isJsonRecord(entityData.projects?.package_snapshot)
          ? entityData.projects?.package_snapshot
          : undefined;
        return snapshot && typeof snapshot.name === 'string' ? snapshot.name : '';
      })();

  console.log('Workflow email - Mock data values:', {
    customer_name: resolvedCustomerName,
    lead_name: resolvedCustomerName,
    lead_email: resolvedCustomerEmail,
    lead_phone: resolvedCustomerPhone,
    session_name: resolvedSessionName,
    session_status: resolvedSessionStatus,
    session_type: resolvedSessionType,
    session_duration: resolvedSessionDuration,
    session_date: formattedSessionDate,
    session_time: formattedSessionTime,
    session_location: resolvedSessionLocation,
    session_meeting_url: resolvedMeetingUrl,
    session_notes: resolvedSessionNotes,
    project_name: resolvedProjectName,
    project_type: typeof entityData.project_type === 'string' ? entityData.project_type : '',
    project_package_name: resolvedProjectPackage,
    business_name: orgSettings?.photography_business_name || 'Your Business',
    studio_name: orgSettings?.photography_business_name || 'Your Business',
    client_name: resolvedCustomerName,
    client_email: resolvedCustomerEmail,
    customer_email: resolvedCustomerEmail,
    ...entityData
  });

  // Try to use send-template-email function first
  try {
    const { data, error } = await supabase.functions.invoke('send-template-email', {
      body: {
        template_id: templateId,
        recipient_email: clientEmail,
        recipient_name: resolvedCustomerName,
        mockData: {
          // Customer/Lead info - Use fallback properties to ensure {lead_name} gets replaced
          customer_name: resolvedCustomerName,
          lead_name: resolvedCustomerName,
          lead_email: resolvedCustomerEmail,
          lead_phone: resolvedCustomerPhone,
          
          // Session info with proper formatting using org settings
          session_name: resolvedSessionName,
          session_status: resolvedSessionStatus,
          session_type: resolvedSessionType,
          session_duration: resolvedSessionDuration,
          session_date: formattedSessionDate,
          session_time: formattedSessionTime,
          session_location: resolvedSessionLocation,
          session_meeting_url: resolvedMeetingUrl,
          session_notes: resolvedSessionNotes,
          
          // Project info
          project_name: resolvedProjectName,
          project_type: typeof entityData.project_type === 'string' ? entityData.project_type : '',
          project_package_name: resolvedProjectPackage,
          
          // Business info from organization settings
          business_name: orgSettings?.photography_business_name || 'Your Business',
          studio_name: orgSettings?.photography_business_name || 'Your Business',
          
          // Additional fallback mappings for common template variables
          client_name: resolvedCustomerName,
          client_email: resolvedCustomerEmail,
          customer_email: resolvedCustomerEmail,
          
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
async function executeCreateReminderStep(
  supabase: GenericSupabaseClient,
  step: WorkflowStepRecord,
  execution: WorkflowExecutionRecord
) {
  const config = step.action_config;
  const delayMinutes = getNumber(config, 'delay_minutes') ?? 60;
  const content = getString(config, 'content') ?? 'Workflow reminder';

  // Calculate reminder date/time
  const reminderDate = new Date();
  reminderDate.setMinutes(reminderDate.getMinutes() + delayMinutes);

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
async function executeUpdateStatusStep(
  supabase: GenericSupabaseClient,
  step: WorkflowStepRecord,
  execution: WorkflowExecutionRecord
) {
  const newStatusId = getString(step.action_config, 'new_status_id');

  if (!newStatusId) {
    console.warn('No new_status_id specified for update status step');
    return;
  }

  const statusField = execution.trigger_entity_type === 'session' ? 'status' : 'status_id';
  const table = execution.trigger_entity_type === 'session' ? 'sessions' : 
                execution.trigger_entity_type === 'project' ? 'projects' : 'leads';

  const { error } = await supabase
    .from(table)
    .update({ [statusField]: newStatusId })
    .eq('id', execution.trigger_entity_id);

  if (error) {
    throw new Error(`Failed to update status: ${getErrorMessage(error)}`);
  }

  console.log(`Updated ${execution.trigger_entity_type} status to ${newStatusId}`);
}

// Get entity data for template variables
async function getEntityData(
  supabase: GenericSupabaseClient,
  entityType: string,
  entityId: string,
  triggerData?: JsonRecord
): Promise<EntityData> {
  let entityData: EntityData = {};
  
  if (entityType === 'session') {
    const sessionDataRecord = triggerData && isJsonRecord(triggerData.session_data) ? triggerData.session_data : undefined;
    const leadDataRecord = triggerData && isJsonRecord(triggerData.lead_data) ? triggerData.lead_data : undefined;

    // If we have session data from trigger (e.g., from reminder processing), use it first for consistency
    if (sessionDataRecord && leadDataRecord) {
      console.log('Using session data from trigger_data to ensure consistency');
      console.log('Trigger session data:', sessionDataRecord);
      console.log('Trigger lead data:', leadDataRecord);
      
      // Validate that the session ID matches what we expect
      const validationRecord = triggerData && isJsonRecord(triggerData.debug_session_validation) ? triggerData.debug_session_validation : undefined;
      if (validationRecord) {
        console.log('Session validation:', validationRecord);
        if (validationRecord.expected_session_id !== entityId) {
          console.error(`❌ CRITICAL SESSION ID MISMATCH!`);
          console.error(`Expected session: ${validationRecord.expected_session_id}`);
          console.error(`Received entity: ${entityId}`);  
          console.error(`Reminder type: ${validationRecord.reminder_type}`);
          console.error(`This would cause wrong session notifications!`);
          throw new Error(`Session ID mismatch: Expected ${validationRecord.expected_session_id} but got ${entityId} for ${validationRecord.reminder_type}`);
        }
        
        console.log(`✅ Session validation passed for ${validationRecord.reminder_type}`);
        console.log(`Processing session: ${entityId} (${sessionDataRecord.session_date} ${sessionDataRecord.session_time})`);
      }
      
      entityData = {
        session_date: getString(sessionDataRecord, 'session_date'),
        session_time: getString(sessionDataRecord, 'session_time'),
        location: getString(sessionDataRecord, 'location'),
        notes: getString(sessionDataRecord, 'notes'),
        session_name: getString(sessionDataRecord, 'session_name'),
        status: getString(sessionDataRecord, 'status'),
        session_type_name: getString(sessionDataRecord, 'session_type_name') || getString(sessionDataRecord, 'session_type'),
        session_type_duration_minutes: getNumber(sessionDataRecord, 'session_type_duration_minutes'),
        meeting_url: getString(sessionDataRecord, 'meeting_url'),
        project_package_name: getString(sessionDataRecord, 'project_package_name'),
        customer_name: getString(leadDataRecord, 'name'),
        customer_email: getString(leadDataRecord, 'email'),
        customer_phone: getString(leadDataRecord, 'phone') || '-',
        client_email: getString(leadDataRecord, 'email'),
        // Add all trigger data
        ...sessionDataRecord,
        ...leadDataRecord,
        // Map lead data to expected field names
        leads: {
          name: getString(leadDataRecord, 'name'),
          email: getString(leadDataRecord, 'email'),
          phone: getString(leadDataRecord, 'phone')
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
          package_snapshot,
          project_types (
            name
          )
        )
      `)
      .eq('id', entityId)
      .single<SessionRecord>();

    // Get lead field values if we have a lead
    let leadFieldValues: Record<string, string> = {};
    if (session?.leads?.id) {
      const { data: fieldValues } = await supabase
        .from('lead_field_values')
        .select('field_key, value')
        .eq('lead_id', session.leads.id)
        ;
      
      if (fieldValues) {
        leadFieldValues = fieldValues.reduce<Record<string, string>>((acc, fv) => {
          acc[`lead_${fv.field_key}`] = fv.value ?? '-';
          return acc;
        }, {});
      }
    }
    
      entityData = {
        session_date: session?.session_date,
        session_time: session?.session_time,
        location: session?.location,
        notes: session?.notes,
        session_name: session?.session_name ?? undefined,
        status: session?.status ?? undefined,
        session_type_name: session?.session_types?.name ?? undefined,
        session_type_duration_minutes: session?.session_types?.duration_minutes ?? undefined,
        meeting_url: (session as { meeting_url?: string }).meeting_url,
        customer_name: session?.leads?.name,
        customer_email: session?.leads?.email,
        customer_phone: session?.leads?.phone || '-',
        project_name: session?.projects?.name,
        project_type: session?.projects?.project_types?.name || '',
        client_email: session?.leads?.email,
        session_type_id: session?.session_type_id ?? null,
        project_package_name: (() => {
          const snapshot = isJsonRecord(session?.projects?.package_snapshot) ? session?.projects?.package_snapshot : undefined;
          return snapshot && typeof snapshot.name === 'string' ? snapshot.name : '';
        })(),
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
      .single<ProjectRecord>();

    // Get lead field values if we have a lead
    let leadFieldValues: Record<string, string> = {};
    if (project?.leads?.id) {
      const { data: fieldValues } = await supabase
        .from('lead_field_values')
        .select('field_key, value')
        .eq('lead_id', project.leads.id)
        ;
      
      if (fieldValues) {
        leadFieldValues = fieldValues.reduce<Record<string, string>>((acc, fv) => {
          acc[`lead_${fv.field_key}`] = fv.value ?? '-';
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
      project_package_name: (() => {
        const snapshot = isJsonRecord(project?.package_snapshot) ? project?.package_snapshot : undefined;
        return snapshot && typeof snapshot.name === 'string' ? snapshot.name : '';
      })(),
      ...leadFieldValues,
      ...project
    };
  } else if (entityType === 'lead') {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', entityId)
      .single<LeadRecord>();

    // Get lead field values
    let leadFieldValues: Record<string, string> = {};
    if (lead?.id) {
      const { data: fieldValues } = await supabase
        .from('lead_field_values')
        .select('field_key, value')
        .eq('lead_id', lead.id)
        ;
      
      if (fieldValues) {
        leadFieldValues = fieldValues.reduce<Record<string, string>>((acc, fv) => {
          acc[`lead_${fv.field_key}`] = fv.value ?? '-';
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
function evaluateTriggerConditions(
  conditions: JsonRecord | null | undefined,
  triggerData: JsonRecord | undefined
): boolean {
  console.log(`Evaluating conditions:`, JSON.stringify(conditions));
  console.log(`Against trigger data:`, JSON.stringify(triggerData));
  if (!conditions) {
    console.log(`No specific conditions found, defaulting to true`);
    return true;
  }

  const payload = triggerData ?? {};

  // Simple condition evaluation - can be extended
  const statusChangedTo = getString(conditions, 'status_changed_to');
  if (statusChangedTo) {
    const result = getString(payload, 'new_status') === statusChangedTo;
    console.log(`Status changed to condition: ${result}`);
    return result;
  }
  
  const statusChangedFrom = getString(conditions, 'status_changed_from');
  if (statusChangedFrom) {
    const result = getString(payload, 'old_status') === statusChangedFrom;
    console.log(`Status changed from condition: ${result}`);
    return result;
  }

  // Session reminder conditions - CRITICAL FIX: Strict matching
  const reminderType = getString(conditions, 'reminder_type');
  if (reminderType) {
    const result = getString(payload, 'reminder_type') === reminderType;
    console.log(`Reminder type condition (${reminderType} === ${getString(payload, 'reminder_type')}): ${result}`);
    return result;
  }

  const reminderDays = getNumber(conditions, 'reminder_days');
  if (typeof reminderDays === 'number') {
    const result = getNumber(payload, 'reminder_days') === reminderDays;
    console.log(`Reminder days condition (${reminderDays} === ${getNumber(payload, 'reminder_days')}): ${result}`);
    return result;
  }

  const reminderHours = getNumber(conditions, 'reminder_hours');
  if (typeof reminderHours === 'number') {
    const result = getNumber(payload, 'reminder_hours') === reminderHours;
    console.log(`Reminder hours condition (${reminderHours} === ${getNumber(payload, 'reminder_hours')}): ${result}`);
    return result;
  }

  // Default to true if no specific conditions
  console.log(`No specific conditions found, defaulting to true`);
  return true;
}

// Evaluate step conditions
function evaluateStepConditions(conditions: JsonRecord | null | undefined, execution: WorkflowExecutionRecord): boolean {
  // Simple condition evaluation - can be extended
  // For now, just return true
  return true;
}

// Update execution status
async function updateExecutionStatus(
  supabase: GenericSupabaseClient,
  executionId: string,
  status: string,
  message?: string
) {
  const updates: JsonRecord = { status };
  
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
