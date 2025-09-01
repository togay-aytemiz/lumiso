-- Create trigger to detect project milestone changes (transitions to completed/cancelled lifecycle)
CREATE OR REPLACE FUNCTION public.handle_project_milestone_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_lifecycle TEXT;
  new_lifecycle TEXT;
  assignee_id UUID;
  org_id UUID;
BEGIN
  -- Get the lifecycle values for old and new statuses
  SELECT lifecycle INTO old_lifecycle FROM project_statuses WHERE id = OLD.status_id;
  SELECT lifecycle INTO new_lifecycle FROM project_statuses WHERE id = NEW.status_id;
  
  -- Only trigger if transitioning TO completed or cancelled lifecycle
  IF (old_lifecycle != new_lifecycle) AND (new_lifecycle IN ('completed', 'cancelled')) THEN
    -- Get organization_id
    org_id := NEW.organization_id;
    
    -- Create notification log entries for each assignee (except the person making the change)
    FOREACH assignee_id IN ARRAY NEW.assignees
    LOOP
      -- Don't notify the person making the change
      IF assignee_id != auth.uid() THEN
        INSERT INTO public.notification_logs (
          organization_id,
          user_id,
          notification_type,
          status,
          created_at
        ) VALUES (
          org_id,
          assignee_id,
          'project-milestone',
          'pending',
          now()
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS project_milestone_trigger ON public.projects;
CREATE TRIGGER project_milestone_trigger
  AFTER UPDATE OF status_id ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_project_milestone_notifications();