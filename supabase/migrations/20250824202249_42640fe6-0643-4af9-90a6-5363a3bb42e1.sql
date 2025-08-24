-- Create workflows system tables for Phase 2

-- Workflows table - defines automation rules
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'session_booked', 'payment_due', 'status_changed', etc.
  trigger_conditions JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Workflow steps table - sequential actions in a workflow
CREATE TABLE public.workflow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  action_type TEXT NOT NULL, -- 'send_template', 'create_task', 'update_status', etc.
  action_config JSONB NOT NULL DEFAULT '{}',
  delay_minutes INTEGER DEFAULT 0, -- delay before executing this step
  conditions JSONB DEFAULT '{}', -- conditions that must be met
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Workflow executions table - track workflow runs and results
CREATE TABLE public.workflow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_entity_type TEXT NOT NULL, -- 'session', 'project', 'lead', etc.
  trigger_entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  execution_log JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for workflows
CREATE POLICY "Organization members can create workflows" ON public.workflows
  FOR INSERT WITH CHECK (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can view workflows" ON public.workflows
  FOR SELECT USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can update workflows" ON public.workflows
  FOR UPDATE USING (organization_id = get_user_active_organization_id());

CREATE POLICY "Organization members can delete workflows" ON public.workflows
  FOR DELETE USING (organization_id = get_user_active_organization_id());

-- RLS policies for workflow_steps
CREATE POLICY "Organization members can manage workflow steps" ON public.workflow_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workflows w 
      WHERE w.id = workflow_steps.workflow_id 
      AND w.organization_id = get_user_active_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflows w 
      WHERE w.id = workflow_steps.workflow_id 
      AND w.organization_id = get_user_active_organization_id()
    )
  );

-- RLS policies for workflow_executions
CREATE POLICY "Organization members can view workflow executions" ON public.workflow_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workflows w 
      WHERE w.id = workflow_executions.workflow_id 
      AND w.organization_id = get_user_active_organization_id()
    )
  );

CREATE POLICY "System can manage workflow executions" ON public.workflow_executions
  FOR ALL USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_workflows_organization_id ON public.workflows(organization_id);
CREATE INDEX idx_workflows_trigger_type ON public.workflows(trigger_type);
CREATE INDEX idx_workflow_steps_workflow_id ON public.workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_order ON public.workflow_steps(workflow_id, step_order);
CREATE INDEX idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX idx_workflow_executions_entity ON public.workflow_executions(trigger_entity_type, trigger_entity_id);