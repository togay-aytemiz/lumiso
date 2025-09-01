-- Add metadata column to notification_logs to store project context
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update the milestone trigger function to store project context in metadata
CREATE OR REPLACE FUNCTION public.log_project_milestone_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_lifecycle TEXT;
  new_lifecycle TEXT;
  assignee_id UUID;
  old_status_name TEXT;
  new_status_name TEXT;
BEGIN
  -- Get lifecycle and names for old and new status
  IF OLD.status_id IS NOT NULL THEN
    SELECT lifecycle, name INTO old_lifecycle, old_status_name 
    FROM public.project_statuses 
    WHERE id = OLD.status_id;
  END IF;
  
  IF NEW.status_id IS NOT NULL THEN
    SELECT lifecycle, name INTO new_lifecycle, new_status_name 
    FROM public.project_statuses 
    WHERE id = NEW.status_id;
  END IF;
  
  -- Check if lifecycle changed to completed or cancelled
  IF (old_lifecycle IS DISTINCT FROM new_lifecycle) AND 
     (new_lifecycle IN ('completed', 'cancelled')) THEN
    
    -- Create notification logs for ALL assignees with project context in metadata
    FOR assignee_id IN SELECT UNNEST(NEW.assignees) LOOP
      INSERT INTO public.notification_logs (
        organization_id,
        user_id,
        notification_type,
        status,
        metadata,
        created_at
      ) VALUES (
        NEW.organization_id,
        assignee_id,
        'project-milestone',
        'pending',
        jsonb_build_object(
          'project_id', NEW.id,
          'project_name', NEW.name,
          'old_status', old_status_name,
          'new_status', new_status_name,
          'old_lifecycle', old_lifecycle,
          'new_lifecycle', new_lifecycle
        ),
        NOW()
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';