export interface Workflow {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  trigger_type: string;
  trigger_conditions?: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  action_type: 'send_email' | 'send_sms' | 'send_whatsapp' | 'create_reminder' | 'update_status';
  action_config: {
    template_id?: string;
    channels?: ('email' | 'sms' | 'whatsapp')[];
    delay_minutes?: number;
    conditions?: Record<string, any>;
    [key: string]: any;
  };
  delay_minutes?: number;
  conditions?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  execution_log?: any[];
  error_message?: string;
  created_at: string;
}

export type TriggerType = 'session_scheduled' | 'session_confirmed' | 'session_completed' | 'session_cancelled' | 'session_rescheduled' | 'project_status_change' | 'lead_status_change';

export interface WorkflowFormData {
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_conditions?: Record<string, any>;
  is_active: boolean;
  steps: Omit<WorkflowStep, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>[];
}