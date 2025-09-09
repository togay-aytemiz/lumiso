-- Update the trigger function to handle both scheduled and rescheduled events
CREATE OR REPLACE FUNCTION public.trigger_session_workflows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger for session_scheduled events (new inserts)
  IF TG_OP = 'INSERT' THEN
    -- Call workflow executor via HTTP (async)
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
          'location', COALESCE(NEW.location, ''),
          'notes', COALESCE(NEW.notes, ''),
          'project_id', NEW.project_id::text,
          'lead_id', NEW.lead_id::text
        )
      )::jsonb
    );
  -- Trigger for session updates (rescheduled)
  ELSIF TG_OP = 'UPDATE' AND (OLD.session_date != NEW.session_date OR OLD.session_time != NEW.session_time) THEN
    -- Only trigger if date or time changed (rescheduled)
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
          'location', COALESCE(NEW.location, ''),
          'notes', COALESCE(NEW.notes, ''),
          'project_id', NEW.project_id::text,
          'lead_id', NEW.lead_id::text,
          'old_session_date', OLD.session_date::text,
          'old_session_time', OLD.session_time::text
        )
      )::jsonb
    );
  END IF;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;