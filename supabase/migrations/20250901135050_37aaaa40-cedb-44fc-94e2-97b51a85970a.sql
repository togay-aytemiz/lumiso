-- Update detect_new_lead_assignees function to include self-assignments
CREATE OR REPLACE FUNCTION public.detect_new_lead_assignees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assignee_id uuid;
  old_assignees uuid[] := ARRAY[]::uuid[];
  new_assignees uuid[] := ARRAY[]::uuid[];
  notification_record RECORD;
  http_request_id bigint;
BEGIN
  -- Get old and new assignees based on operation type
  IF TG_OP = 'INSERT' THEN
    -- For INSERT, all assignees are "new"
    old_assignees := ARRAY[]::uuid[];
    new_assignees := COALESCE(NEW.assignees, ARRAY[]::uuid[]);
  ELSIF TG_OP = 'UPDATE' THEN
    -- For UPDATE, compare old vs new
    old_assignees := COALESCE(OLD.assignees, ARRAY[]::uuid[]);
    new_assignees := COALESCE(NEW.assignees, ARRAY[]::uuid[]);
  END IF;

  -- Find newly assigned users (in new_assignees but not in old_assignees)
  FOR assignee_id IN 
    SELECT UNNEST(new_assignees)
    EXCEPT 
    SELECT UNNEST(old_assignees)
  LOOP
    -- Get user profile and organization settings for notification
    SELECT 
      p.full_name as assignee_name,
      u.email as assignee_email,
      creator.full_name as assigner_name,
      os.notification_new_assignment_enabled,
      os.notification_global_enabled
    INTO notification_record
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.user_id
    LEFT JOIN public.profiles creator ON NEW.user_id = creator.user_id
    LEFT JOIN public.organization_settings os ON NEW.organization_id = os.organization_id
    WHERE u.id = assignee_id;

    -- Only send notification if enabled and we have the necessary data
    IF notification_record.notification_global_enabled = true 
       AND notification_record.notification_new_assignment_enabled = true 
       AND notification_record.assignee_email IS NOT NULL THEN
      
      -- Log the notification attempt first
      INSERT INTO public.notification_logs (
        organization_id,
        user_id,
        notification_type,
        status,
        sent_at
      ) VALUES (
        NEW.organization_id,
        assignee_id,
        'new-assignment',
        'pending',
        NOW()
      );

      -- Call the edge function directly for immediate delivery
      SELECT extensions.http_post(
        url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/send-reminder-notifications',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.a8z_bUe1HW_SBGWxQqFTy3RWLPh2kNvFSRHgxC0l7lY"}'::jsonb,
        body := jsonb_build_object(
          'type', 'new-assignment',
          'entity_type', 'lead',
          'entity_id', NEW.id::text,
          'assignee_id', assignee_id::text,
          'assignee_email', notification_record.assignee_email,
          'assignee_name', notification_record.assignee_name,
          'assigner_name', notification_record.assigner_name,
          'organizationId', NEW.organization_id::text
        )
      ) INTO http_request_id;

      -- Update the notification log with the request status
      UPDATE public.notification_logs 
      SET status = 'sent', sent_at = NOW()
      WHERE organization_id = NEW.organization_id 
        AND user_id = assignee_id 
        AND notification_type = 'new-assignment'
        AND status = 'pending'
        AND sent_at >= NOW() - INTERVAL '1 minute';

    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Update detect_new_project_assignees function to include self-assignments
CREATE OR REPLACE FUNCTION public.detect_new_project_assignees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assignee_id uuid;
  old_assignees uuid[] := ARRAY[]::uuid[];
  new_assignees uuid[] := ARRAY[]::uuid[];
  notification_record RECORD;
  http_request_id bigint;
BEGIN
  -- Get old and new assignees based on operation type
  IF TG_OP = 'INSERT' THEN
    -- For INSERT, all assignees are "new"
    old_assignees := ARRAY[]::uuid[];
    new_assignees := COALESCE(NEW.assignees, ARRAY[]::uuid[]);
  ELSIF TG_OP = 'UPDATE' THEN
    -- For UPDATE, compare old vs new
    old_assignees := COALESCE(OLD.assignees, ARRAY[]::uuid[]);
    new_assignees := COALESCE(NEW.assignees, ARRAY[]::uuid[]);
  END IF;

  -- Find newly assigned users (in new_assignees but not in old_assignees)
  FOR assignee_id IN 
    SELECT UNNEST(new_assignees)
    EXCEPT 
    SELECT UNNEST(old_assignees)
  LOOP
    -- Get user profile and organization settings for notification
    SELECT 
      p.full_name as assignee_name,
      u.email as assignee_email,
      creator.full_name as assigner_name,
      os.notification_new_assignment_enabled,
      os.notification_global_enabled
    INTO notification_record
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.user_id
    LEFT JOIN public.profiles creator ON NEW.user_id = creator.user_id
    LEFT JOIN public.organization_settings os ON NEW.organization_id = os.organization_id
    WHERE u.id = assignee_id;

    -- Only send notification if enabled and we have the necessary data
    IF notification_record.notification_global_enabled = true 
       AND notification_record.notification_new_assignment_enabled = true 
       AND notification_record.assignee_email IS NOT NULL THEN
      
      -- Log the notification attempt first
      INSERT INTO public.notification_logs (
        organization_id,
        user_id,
        notification_type,
        status,
        sent_at
      ) VALUES (
        NEW.organization_id,
        assignee_id,
        'new-assignment',
        'pending',
        NOW()
      );

      -- Call the edge function directly for immediate delivery
      SELECT extensions.http_post(
        url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/send-reminder-notifications',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.a8z_bUe1HW_SBGWxQqFTy3RWLPh2kNvFSRHgxC0l7lY"}'::jsonb,
        body := jsonb_build_object(
          'type', 'new-assignment',
          'entity_type', 'project',
          'entity_id', NEW.id::text,
          'assignee_id', assignee_id::text,
          'assignee_email', notification_record.assignee_email,
          'assignee_name', notification_record.assignee_name,
          'assigner_name', notification_record.assigner_name,
          'organizationId', NEW.organization_id::text
        )
      ) INTO http_request_id;

      -- Update the notification log with the request status
      UPDATE public.notification_logs 
      SET status = 'sent', sent_at = NOW()
      WHERE organization_id = NEW.organization_id 
        AND user_id = assignee_id 
        AND notification_type = 'new-assignment'
        AND status = 'pending'
        AND sent_at >= NOW() - INTERVAL '1 minute';

    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;