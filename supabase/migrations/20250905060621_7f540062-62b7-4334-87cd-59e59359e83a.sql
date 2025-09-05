-- Trigger workflow executions for existing pending scheduled notifications and test workflow
-- First process any existing pending scheduled notifications
UPDATE scheduled_notifications 
SET status = 'pending', retry_count = 0 
WHERE status = 'pending' AND created_at < now();

-- Create a trigger function for workflow execution when sessions are scheduled
CREATE OR REPLACE FUNCTION trigger_session_workflows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only trigger for session_scheduled events (new inserts)
  IF TG_OP = 'INSERT' THEN
    -- Call workflow executor via HTTP (async)
    PERFORM net.http_post(
      url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
      body := json_build_object(
        'action', 'trigger',
        'triggerType', 'session_scheduled',
        'entityType', 'session',
        'entityId', NEW.id::text,
        'organizationId', NEW.organization_id::text,
        'triggerData', json_build_object(
          'session_id', NEW.id::text,
          'title', NEW.title,
          'scheduled_date', NEW.scheduled_date::text,
          'project_id', NEW.project_id::text
        )
      )::jsonb
    );
  END IF;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Create trigger on sessions table
DROP TRIGGER IF EXISTS session_workflow_trigger ON sessions;
CREATE TRIGGER session_workflow_trigger
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_session_workflows();