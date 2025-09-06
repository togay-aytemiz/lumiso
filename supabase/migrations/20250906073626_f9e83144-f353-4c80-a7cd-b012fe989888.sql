-- Fix the trigger function to use correct session table columns
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
          'session_date', NEW.session_date::text,
          'session_time', NEW.session_time::text,
          'location', COALESCE(NEW.location, ''),
          'notes', COALESCE(NEW.notes, ''),
          'project_id', NEW.project_id::text,
          'lead_id', NEW.lead_id::text
        )
      )::jsonb
    );
  END IF;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;