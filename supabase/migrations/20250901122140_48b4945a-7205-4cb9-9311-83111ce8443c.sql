-- Create function to detect new lead assignees and send notifications
CREATE OR REPLACE FUNCTION public.detect_new_lead_assignees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_assignee_id UUID;
  assignee_email TEXT;
  assignee_name TEXT;
  assigner_name TEXT;
  org_settings RECORD;
BEGIN
  -- Only process if assignees array changed
  IF OLD.assignees IS DISTINCT FROM NEW.assignees THEN
    -- Get organization settings for notifications
    SELECT os.notification_global_enabled, os.notification_new_assignment_enabled, os.photography_business_name
    INTO org_settings
    FROM public.organization_settings os
    WHERE os.organization_id = NEW.organization_id;
    
    -- Skip if notifications are disabled globally or for assignments
    IF NOT COALESCE(org_settings.notification_global_enabled, false) OR 
       NOT COALESCE(org_settings.notification_new_assignment_enabled, false) THEN
      RETURN NEW;
    END IF;
    
    -- Get assigner name
    SELECT p.full_name INTO assigner_name
    FROM public.profiles p
    WHERE p.user_id = auth.uid();
    
    -- Find newly added assignees
    FOR new_assignee_id IN 
      SELECT unnest(NEW.assignees) 
      EXCEPT 
      SELECT unnest(COALESCE(OLD.assignees, ARRAY[]::UUID[]))
    LOOP
      -- Get assignee details
      SELECT p.full_name, u.email INTO assignee_name, assignee_email
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.user_id = new_assignee_id;
      
      -- Check if assignee has notifications enabled
      IF EXISTS (
        SELECT 1 FROM public.user_settings us
        WHERE us.user_id = new_assignee_id 
        AND us.notification_global_enabled = true
        AND us.notification_new_assignment_enabled = true
      ) THEN
        
        -- Log the notification
        INSERT INTO public.notification_logs (
          organization_id, user_id, notification_type, status, created_at
        ) VALUES (
          NEW.organization_id, new_assignee_id, 'new_assignment', 'pending', now()
        );
        
        -- Call edge function to send notification
        PERFORM net.http_post(
          url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/send-reminder-notifications',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.8DgGNWKPpKnhj4MLqcKHHKAYJJT2E3CcXFBAgNOWl-E"}'::jsonb,
          body := json_build_object(
            'type', 'new-assignment',
            'entity_type', 'lead',
            'entity_id', NEW.id,
            'assignee_id', new_assignee_id,
            'assignee_email', assignee_email,
            'assignee_name', assignee_name,
            'assigner_name', COALESCE(assigner_name, 'System'),
            'organization_id', NEW.organization_id
          )::jsonb
        );
        
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to detect new project assignees and send notifications  
CREATE OR REPLACE FUNCTION public.detect_new_project_assignees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_assignee_id UUID;
  assignee_email TEXT;
  assignee_name TEXT;
  assigner_name TEXT;
  org_settings RECORD;
BEGIN
  -- Only process if assignees array changed
  IF OLD.assignees IS DISTINCT FROM NEW.assignees THEN
    -- Get organization settings for notifications
    SELECT os.notification_global_enabled, os.notification_new_assignment_enabled, os.photography_business_name
    INTO org_settings
    FROM public.organization_settings os
    WHERE os.organization_id = NEW.organization_id;
    
    -- Skip if notifications are disabled globally or for assignments
    IF NOT COALESCE(org_settings.notification_global_enabled, false) OR 
       NOT COALESCE(org_settings.notification_new_assignment_enabled, false) THEN
      RETURN NEW;
    END IF;
    
    -- Get assigner name
    SELECT p.full_name INTO assigner_name
    FROM public.profiles p
    WHERE p.user_id = auth.uid();
    
    -- Find newly added assignees
    FOR new_assignee_id IN 
      SELECT unnest(NEW.assignees) 
      EXCEPT 
      SELECT unnest(COALESCE(OLD.assignees, ARRAY[]::UUID[]))
    LOOP
      -- Get assignee details
      SELECT p.full_name, u.email INTO assignee_name, assignee_email
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.user_id = new_assignee_id;
      
      -- Check if assignee has notifications enabled
      IF EXISTS (
        SELECT 1 FROM public.user_settings us
        WHERE us.user_id = new_assignee_id 
        AND us.notification_global_enabled = true
        AND us.notification_new_assignment_enabled = true
      ) THEN
        
        -- Log the notification
        INSERT INTO public.notification_logs (
          organization_id, user_id, notification_type, status, created_at
        ) VALUES (
          NEW.organization_id, new_assignee_id, 'new_assignment', 'pending', now()
        );
        
        -- Call edge function to send notification
        PERFORM net.http_post(
          url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/send-reminder-notifications',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.8DgGNWKPpKnhj4MLqcKHHKAYJJT2E3CcXFBAgNOWl-E"}'::jsonb,
          body := json_build_object(
            'type', 'new-assignment',
            'entity_type', 'project',
            'entity_id', NEW.id,
            'assignee_id', new_assignee_id,
            'assignee_email', assignee_email,
            'assignee_name', assignee_name,
            'assigner_name', COALESCE(assigner_name, 'System'),
            'organization_id', NEW.organization_id
          )::jsonb
        );
        
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for lead assignments
CREATE TRIGGER trigger_lead_assignment_notification
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_new_lead_assignees();

-- Create triggers for project assignments  
CREATE TRIGGER trigger_project_assignment_notification
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_new_project_assignees();