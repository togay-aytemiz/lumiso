-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sessions_workflow_trigger ON public.sessions;

-- Create or replace the trigger function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.trigger_session_workflows()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  organization_uuid UUID;
  trigger_data JSONB;
BEGIN
  -- Get organization_id from the session record
  organization_uuid := COALESCE(NEW.organization_id, OLD.organization_id);
  
  IF TG_OP = 'INSERT' THEN
    -- Session created - trigger session_scheduled workflow
    trigger_data := jsonb_build_object(
      'session_date', NEW.session_date::TEXT,
      'session_time', NEW.session_time::TEXT,
      'location', NEW.location,
      'status', NEW.status,
      'project_id', NEW.project_id::TEXT,
      'lead_id', NEW.lead_id::TEXT
    );
    
    -- Call the workflow executor function
    PERFORM public.supabase_url_request(
      'POST',
      public.supabase_url() || '/functions/v1/workflow-executor',
      jsonb_build_object(
        'triggerType', 'session_scheduled',
        'entityType', 'session',
        'entityId', NEW.id::TEXT,
        'organizationId', organization_uuid::TEXT,
        'triggerData', trigger_data
      ),
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.supabase_service_role_key()
      )
    );
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      trigger_data := jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'session_date', NEW.session_date::TEXT,
        'session_time', NEW.session_time::TEXT,
        'location', NEW.location,
        'project_id', NEW.project_id::TEXT,
        'lead_id', NEW.lead_id::TEXT
      );
      
      -- Determine which workflow to trigger based on new status
      IF NEW.status = 'completed' THEN
        PERFORM public.supabase_url_request(
          'POST',
          public.supabase_url() || '/functions/v1/workflow-executor',
          jsonb_build_object(
            'triggerType', 'session_completed',
            'entityType', 'session',
            'entityId', NEW.id::TEXT,
            'organizationId', organization_uuid::TEXT,
            'triggerData', trigger_data
          ),
          jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || public.supabase_service_role_key()
          )
        );
      ELSIF NEW.status = 'cancelled' THEN
        PERFORM public.supabase_url_request(
          'POST',
          public.supabase_url() || '/functions/v1/workflow-executor',
          jsonb_build_object(
            'triggerType', 'session_cancelled',
            'entityType', 'session',
            'entityId', NEW.id::TEXT,
            'organizationId', organization_uuid::TEXT,
            'triggerData', trigger_data
          ),
          jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || public.supabase_service_role_key()
          )
        );
      END IF;
    END IF;
    
    -- Check if date/time changed (rescheduled)
    IF (OLD.session_date IS DISTINCT FROM NEW.session_date) OR 
       (OLD.session_time IS DISTINCT FROM NEW.session_time) THEN
      trigger_data := jsonb_build_object(
        'old_date', OLD.session_date::TEXT,
        'new_date', NEW.session_date::TEXT,
        'old_time', OLD.session_time::TEXT,
        'new_time', NEW.session_time::TEXT,
        'location', NEW.location,
        'status', NEW.status,
        'project_id', NEW.project_id::TEXT,
        'lead_id', NEW.lead_id::TEXT
      );
      
      PERFORM public.supabase_url_request(
        'POST',
        public.supabase_url() || '/functions/v1/workflow-executor',
        jsonb_build_object(
          'triggerType', 'session_rescheduled',
          'entityType', 'session',
          'entityId', NEW.id::TEXT,
          'organizationId', organization_uuid::TEXT,
          'triggerData', trigger_data
        ),
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.supabase_service_role_key()
        )
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the trigger for both INSERT and UPDATE operations
CREATE TRIGGER sessions_workflow_trigger
  AFTER INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_session_workflows();