-- Fix the session workflow trigger function to properly match session statuses with lifecycles
CREATE OR REPLACE FUNCTION public.trigger_session_workflows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_lifecycle text;
  new_lifecycle text;
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
          'project_id', NEW.project_id::text,
          'lead_id', NEW.lead_id::text,
          'session_date', NEW.session_date::text,
          'session_time', NEW.session_time::text,
          'location', NEW.location,
          'notes', NEW.notes,
          'status', NEW.status
        )
      )::text
    );
    RETURN NEW;
  END IF;

  -- Handle UPDATE (status changes)
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Get lifecycle for old and new status
    SELECT ss.lifecycle INTO old_lifecycle 
    FROM public.session_statuses ss 
    WHERE ss.name = OLD.status AND ss.organization_id = NEW.organization_id
    LIMIT 1;
    
    SELECT ss.lifecycle INTO new_lifecycle 
    FROM public.session_statuses ss 
    WHERE ss.name = NEW.status AND ss.organization_id = NEW.organization_id
    LIMIT 1;

    -- Trigger appropriate workflow based on lifecycle change
    IF new_lifecycle = 'completed' AND old_lifecycle != 'completed' THEN
      -- Session completed
      PERFORM net.http_post(
        url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a1BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
        body := json_build_object(
          'action', 'trigger',
          'trigger_type', 'session_completed',
          'trigger_entity_type', 'session',
          'trigger_entity_id', NEW.id::text,
          'organization_id', NEW.organization_id::text,
          'trigger_data', json_build_object(
            'session_id', NEW.id::text,
            'project_id', NEW.project_id::text,
            'lead_id', NEW.lead_id::text,
            'session_date', NEW.session_date::text,
            'session_time', NEW.session_time::text,
            'location', NEW.location,
            'notes', NEW.notes,
            'old_status', OLD.status,
            'new_status', NEW.status
          )
        )::text
      );
    ELSIF new_lifecycle = 'cancelled' AND old_lifecycle != 'cancelled' THEN
      -- Session cancelled
      PERFORM net.http_post(
        url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a1BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
        body := json_build_object(
          'action', 'trigger',
          'trigger_type', 'session_cancelled',
          'trigger_entity_type', 'session',
          'trigger_entity_id', NEW.id::text,
          'organization_id', NEW.organization_id::text,
          'trigger_data', json_build_object(
            'session_id', NEW.id::text,
            'project_id', NEW.project_id::text,
            'lead_id', NEW.lead_id::text,
            'session_date', NEW.session_date::text,
            'session_time', NEW.session_time::text,
            'location', NEW.location,
            'notes', NEW.notes,
            'old_status', OLD.status,
            'new_status', NEW.status
          )
        )::text
      );
    END IF;
    
    -- Handle session rescheduled (date or time changed)
    IF (OLD.session_date != NEW.session_date OR OLD.session_time != NEW.session_time) THEN
      PERFORM net.http_post(
        url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a1BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
        body := json_build_object(
          'action', 'trigger',
          'trigger_type', 'session_rescheduled',
          'trigger_entity_type', 'session',
          'trigger_entity_id', NEW.id::text,
          'organization_id', NEW.organization_id::text,
          'trigger_data', json_build_object(
            'session_id', NEW.id::text,
            'project_id', NEW.project_id::text,
            'lead_id', NEW.lead_id::text,
            'old_session_date', OLD.session_date::text,
            'old_session_time', OLD.session_time::text,
            'new_session_date', NEW.session_date::text,
            'new_session_time', NEW.session_time::text,
            'location', NEW.location,
            'notes', NEW.notes,
            'status', NEW.status
          )
        )::text
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$function$;