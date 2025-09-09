-- First, drop all existing session workflow triggers to clean up duplicates
DROP TRIGGER IF EXISTS trigger_session_workflows_on_insert ON public.sessions;
DROP TRIGGER IF EXISTS trigger_session_workflows_on_update ON public.sessions;
DROP TRIGGER IF EXISTS sessions_workflow_trigger ON public.sessions;

-- Create a comprehensive session workflow trigger function
CREATE OR REPLACE FUNCTION public.trigger_session_workflows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Handle INSERT (session_scheduled)
  IF TG_OP = 'INSERT' THEN
    PERFORM net.http_post(
      url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
      body := json_build_object(
        'action', 'trigger',
        'trigger_type', 'session_scheduled',
        'trigger_entity_type', 'session',
        'trigger_entity_id', NEW.id::text,
        'organization_id', NEW.organization_id::text,
        'trigger_data', json_build_object(
          'session_id', NEW.id::text,
          'session_date', NEW.session_date::text,
          'session_time', NEW.session_time::text,
          'session_location', COALESCE(NEW.location, ''),
          'session_notes', COALESCE(NEW.notes, ''),
          'project_id', NEW.project_id::text,
          'lead_id', NEW.lead_id::text
        )
      )::jsonb
    );
  -- Handle UPDATE for date/time changes (session_rescheduled)
  ELSIF TG_OP = 'UPDATE' AND (OLD.session_date != NEW.session_date OR OLD.session_time != NEW.session_time) THEN
    PERFORM net.http_post(
      url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
      body := json_build_object(
        'action', 'trigger',
        'trigger_type', 'session_rescheduled',
        'trigger_entity_type', 'session',
        'trigger_entity_id', NEW.id::text,
        'organization_id', NEW.organization_id::text,
        'trigger_data', json_build_object(
          'session_id', NEW.id::text,
          'session_date', NEW.session_date::text,
          'session_time', NEW.session_time::text,
          'session_location', COALESCE(NEW.location, ''),
          'session_notes', COALESCE(NEW.notes, ''),
          'project_id', NEW.project_id::text,
          'lead_id', NEW.lead_id::text,
          'old_session_date', OLD.session_date::text,
          'old_session_time', OLD.session_time::text
        )
      )::jsonb
    );
  -- Handle status changes to cancelled
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Get the status name from session_statuses to determine the lifecycle
    DECLARE 
      status_lifecycle TEXT;
    BEGIN
      SELECT lifecycle INTO status_lifecycle 
      FROM session_statuses 
      WHERE organization_id = NEW.organization_id 
      AND name = NEW.status;
      
      -- Trigger for cancelled sessions
      IF status_lifecycle = 'cancelled' THEN
        PERFORM net.http_post(
          url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
          body := json_build_object(
            'action', 'trigger',
            'trigger_type', 'session_cancelled',
            'trigger_entity_type', 'session',
            'trigger_entity_id', NEW.id::text,
            'organization_id', NEW.organization_id::text,
            'trigger_data', json_build_object(
              'session_id', NEW.id::text,
              'session_date', NEW.session_date::text,
              'session_time', NEW.session_time::text,
              'session_location', COALESCE(NEW.location, ''),
              'session_notes', COALESCE(NEW.notes, ''),
              'project_id', NEW.project_id::text,
              'lead_id', NEW.lead_id::text,
              'old_status', OLD.status,
              'new_status', NEW.status
            )
          )::jsonb
        );
      -- Trigger for completed sessions
      ELSIF status_lifecycle = 'completed' THEN
        PERFORM net.http_post(
          url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
          body := json_build_object(
            'action', 'trigger',
            'trigger_type', 'session_completed',
            'trigger_entity_type', 'session',
            'trigger_entity_id', NEW.id::text,
            'organization_id', NEW.organization_id::text,
            'trigger_data', json_build_object(
              'session_id', NEW.id::text,
              'session_date', NEW.session_date::text,
              'session_time', NEW.session_time::text,
              'session_location', COALESCE(NEW.location, ''),
              'session_notes', COALESCE(NEW.notes, ''),
              'project_id', NEW.project_id::text,
              'lead_id', NEW.lead_id::text,
              'old_status', OLD.status,
              'new_status', NEW.status
            )
          )::jsonb
        );
      END IF;
    END;
  END IF;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- Create a single trigger for all session workflow events
CREATE TRIGGER sessions_workflow_trigger
    AFTER INSERT OR UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_session_workflows();