-- Remove the hardcoded sessions status check constraint
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;

-- Drop and recreate the workflow trigger function with the missing 'action' parameter
DROP TRIGGER IF EXISTS sessions_workflow_trigger ON public.sessions;
DROP FUNCTION IF EXISTS public.trigger_session_workflows();

-- Create improved session workflow trigger function with proper action parameter
CREATE OR REPLACE FUNCTION public.trigger_session_workflows()
RETURNS TRIGGER AS $$
DECLARE
  old_lifecycle text;
  new_lifecycle text;
  workflow_trigger_type text;
BEGIN
  -- Get the lifecycle of the old status (case-insensitive)
  IF OLD.status IS NOT NULL THEN
    SELECT ss.lifecycle INTO old_lifecycle
    FROM public.session_statuses ss
    WHERE ss.organization_id = OLD.organization_id 
    AND LOWER(ss.name) = LOWER(OLD.status);
  END IF;

  -- Get the lifecycle of the new status (case-insensitive)
  SELECT ss.lifecycle INTO new_lifecycle
  FROM public.session_statuses ss
  WHERE ss.organization_id = NEW.organization_id 
  AND LOWER(ss.name) = LOWER(NEW.status);

  -- Only trigger workflows if lifecycle actually changed
  IF old_lifecycle IS DISTINCT FROM new_lifecycle AND new_lifecycle IS NOT NULL THEN
    -- Determine the workflow trigger type based on the new lifecycle
    workflow_trigger_type := CASE 
      WHEN new_lifecycle = 'completed' THEN 'session_completed'
      WHEN new_lifecycle = 'cancelled' THEN 'session_cancelled'
      ELSE NULL
    END;

    -- Only invoke workflow executor if we have a valid trigger type
    IF workflow_trigger_type IS NOT NULL THEN
      -- Call the workflow executor edge function with the required 'action' parameter
      PERFORM net.http_post(
        url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.jwt_secret', true)
        ),
        body := jsonb_build_object(
          'action', 'trigger',
          'trigger_type', workflow_trigger_type,
          'entity_type', 'session',
          'entity_id', NEW.id,
          'organization_id', NEW.organization_id,
          'trigger_data', jsonb_build_object(
            'session_id', NEW.id,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'old_lifecycle', old_lifecycle,
            'new_lifecycle', new_lifecycle,
            'session_date', NEW.session_date,
            'session_time', NEW.session_time,
            'location', NEW.location,
            'project_id', NEW.project_id,
            'lead_id', NEW.lead_id,
            'user_id', NEW.user_id
          )
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER sessions_workflow_trigger
  AFTER UPDATE OF status ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_session_workflows();

-- Add a foreign key constraint to validate session status exists in session_statuses table
-- This replaces the hardcoded check constraint with dynamic validation
ALTER TABLE public.sessions 
ADD CONSTRAINT sessions_status_fkey 
FOREIGN KEY (status, organization_id) 
REFERENCES public.session_statuses(name, organization_id) 
DEFERRABLE INITIALLY DEFERRED;