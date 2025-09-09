-- Phase 1: Critical Workflow System Fixes (Fixed)

-- First, clean up the stuck workflow execution
UPDATE workflow_executions 
SET status = 'failed', 
    completed_at = NOW(),
    error_message = 'Execution timed out - cleaned up by system maintenance'
WHERE status = 'running' 
AND started_at < NOW() - INTERVAL '5 minutes';

-- Create workflow execution cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_workflow_executions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cleaned_count INTEGER := 0;
BEGIN
  -- Clean up executions older than 30 days
  DELETE FROM public.workflow_executions 
  WHERE created_at < (NOW() - INTERVAL '30 days')
  AND status IN ('completed', 'failed', 'cancelled');
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Clean up stuck executions (running for more than 5 minutes)
  UPDATE public.workflow_executions 
  SET status = 'failed', 
      completed_at = NOW(),
      error_message = 'Execution timed out'
  WHERE status = 'running' 
  AND started_at < NOW() - INTERVAL '5 minutes';
  
  RETURN cleaned_count;
END;
$$;

-- Create simple fingerprinting for better duplicate prevention (without digest)
CREATE OR REPLACE FUNCTION public.get_workflow_execution_fingerprint(
  workflow_id_param UUID,
  trigger_entity_type_param TEXT,
  trigger_entity_id_param UUID,
  trigger_data_param JSONB DEFAULT '{}'::JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create a simple fingerprint using string concatenation and hashing
  RETURN md5(
    workflow_id_param::TEXT || 
    trigger_entity_type_param || 
    trigger_entity_id_param::TEXT ||
    COALESCE(trigger_data_param->>'status_change', '') ||
    COALESCE(trigger_data_param->>'date_change', '')
  );
END;
$$;

-- Add indexes for better workflow performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_created 
ON workflow_executions(status, created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_entity 
ON workflow_executions(workflow_id, trigger_entity_type, trigger_entity_id);

CREATE INDEX IF NOT EXISTS idx_workflows_trigger_active 
ON workflows(trigger_type, organization_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_order 
ON workflow_steps(workflow_id, step_order) 
WHERE is_active = true;

-- Add workflow execution metrics table for monitoring
CREATE TABLE IF NOT EXISTS public.workflow_execution_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  average_execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, date)
);

-- Create function to update workflow metrics
CREATE OR REPLACE FUNCTION public.update_workflow_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  org_id UUID;
  exec_time_ms INTEGER;
BEGIN
  -- Get organization_id from the workflow
  SELECT w.organization_id INTO org_id
  FROM public.workflows w
  WHERE w.id = NEW.workflow_id;
  
  IF org_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate execution time if completed
  IF NEW.status IN ('completed', 'failed') AND NEW.started_at IS NOT NULL THEN
    exec_time_ms := EXTRACT(EPOCH FROM (COALESCE(NEW.completed_at, NOW()) - NEW.started_at)) * 1000;
  END IF;
  
  -- Update or insert metrics
  INSERT INTO public.workflow_execution_metrics (
    organization_id, 
    date, 
    total_executions,
    successful_executions,
    failed_executions,
    average_execution_time_ms
  )
  VALUES (
    org_id,
    CURRENT_DATE,
    1,
    CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    COALESCE(exec_time_ms, 0)
  )
  ON CONFLICT (organization_id, date)
  DO UPDATE SET
    total_executions = workflow_execution_metrics.total_executions + 1,
    successful_executions = workflow_execution_metrics.successful_executions + 
      CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
    failed_executions = workflow_execution_metrics.failed_executions + 
      CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    average_execution_time_ms = (
      workflow_execution_metrics.average_execution_time_ms * (workflow_execution_metrics.total_executions - 1) +
      COALESCE(exec_time_ms, 0)
    ) / workflow_execution_metrics.total_executions,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$;

-- Create trigger for workflow metrics
DROP TRIGGER IF EXISTS workflow_execution_metrics_trigger ON public.workflow_executions;
CREATE TRIGGER workflow_execution_metrics_trigger
  AFTER UPDATE OF status ON public.workflow_executions
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status)
  EXECUTE FUNCTION public.update_workflow_metrics();
  
-- Add RLS policies for workflow metrics
ALTER TABLE public.workflow_execution_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view workflow metrics"
  ON public.workflow_execution_metrics FOR SELECT
  USING (organization_id = get_user_active_organization_id());

-- System can manage metrics
CREATE POLICY "System can manage workflow metrics"
  ON public.workflow_execution_metrics FOR ALL
  USING (true)
  WITH CHECK (true);