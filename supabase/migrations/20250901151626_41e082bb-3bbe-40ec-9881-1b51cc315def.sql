-- Create function to log project milestone changes
CREATE OR REPLACE FUNCTION public.log_project_milestone_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_lifecycle TEXT;
  new_lifecycle TEXT;
  assignee_id UUID;
BEGIN
  -- Get lifecycle for old and new status
  IF OLD.status_id IS NOT NULL THEN
    SELECT lifecycle INTO old_lifecycle 
    FROM public.project_statuses 
    WHERE id = OLD.status_id;
  END IF;
  
  IF NEW.status_id IS NOT NULL THEN
    SELECT lifecycle INTO new_lifecycle 
    FROM public.project_statuses 
    WHERE id = NEW.status_id;
  END IF;
  
  -- Check if lifecycle changed to completed or cancelled
  IF (old_lifecycle IS DISTINCT FROM new_lifecycle) AND 
     (new_lifecycle IN ('completed', 'cancelled')) THEN
    
    -- Create notification logs for each assignee (excluding the user who made the change)
    FOR assignee_id IN SELECT UNNEST(NEW.assignees) LOOP
      IF assignee_id != COALESCE(auth.uid(), NEW.user_id) THEN
        INSERT INTO public.notification_logs (
          organization_id,
          user_id,
          notification_type,
          status,
          created_at
        ) VALUES (
          NEW.organization_id,
          assignee_id,
          'project-milestone',
          'pending',
          NOW()
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;