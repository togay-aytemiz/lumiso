-- Remove the HTTP calls from triggers and simplify to just logging
-- We'll handle the immediate notification from the application layer instead

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

    -- Only create notification record if enabled and we have the necessary data
    IF notification_record.notification_global_enabled = true 
       AND notification_record.notification_new_assignment_enabled = true 
       AND notification_record.assignee_email IS NOT NULL THEN
      
      -- Just log the notification as pending - the application will handle sending
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
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

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

    -- Only create notification record if enabled and we have the necessary data
    IF notification_record.notification_global_enabled = true 
       AND notification_record.notification_new_assignment_enabled = true 
       AND notification_record.assignee_email IS NOT NULL THEN
      
      -- Just log the notification as pending - the application will handle sending
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
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;