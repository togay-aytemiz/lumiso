-- Add foreign key constraints to scheduled_session_reminders table
ALTER TABLE public.scheduled_session_reminders 
ADD CONSTRAINT fk_scheduled_session_reminders_organization 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.scheduled_session_reminders 
ADD CONSTRAINT fk_scheduled_session_reminders_session 
FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE public.scheduled_session_reminders 
ADD CONSTRAINT fk_scheduled_session_reminders_workflow 
FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;

-- Create default session reminder workflows function
CREATE OR REPLACE FUNCTION public.ensure_default_session_reminder_workflows(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  workflow_count INTEGER;
  reminder_workflow_id UUID;
  template_id UUID;
BEGIN
  -- Check if organization already has session reminder workflows
  SELECT COUNT(*) INTO workflow_count 
  FROM public.workflows 
  WHERE organization_id = org_id AND trigger_type = 'session_reminder';
  
  -- Only create defaults if no session reminder workflows exist
  IF workflow_count = 0 THEN
    -- First ensure default message templates exist
    PERFORM public.ensure_default_message_templates(user_uuid, org_id);
    
    -- Get a session reminder template
    SELECT id INTO template_id 
    FROM public.message_templates 
    WHERE organization_id = org_id AND category = 'session_reminder'
    LIMIT 1;
    
    -- Create 24-hour reminder workflow
    INSERT INTO public.workflows (user_id, organization_id, name, description, trigger_type, trigger_conditions, is_active)
    VALUES (
      user_uuid, 
      org_id, 
      '24-Hour Session Reminder', 
      'Automatic reminder sent 24 hours before session',
      'session_reminder',
      '{"reminder_hours": 24}'::jsonb,
      true
    ) RETURNING id INTO reminder_workflow_id;
    
    -- Add workflow step for email notification
    INSERT INTO public.workflow_steps (workflow_id, step_order, action_type, action_config, is_active)
    VALUES (
      reminder_workflow_id,
      1,
      'send_notification',
      jsonb_build_object(
        'template_id', template_id,
        'channels', ARRAY['email'],
        'delay_minutes', 0
      ),
      true
    );
    
    -- Create 2-hour reminder workflow
    INSERT INTO public.workflows (user_id, organization_id, name, description, trigger_type, trigger_conditions, is_active)
    VALUES (
      user_uuid, 
      org_id, 
      '2-Hour Session Reminder', 
      'Final reminder sent 2 hours before session',
      'session_reminder',
      '{"reminder_hours": 2}'::jsonb,
      true
    ) RETURNING id INTO reminder_workflow_id;
    
    -- Add workflow step for SMS/WhatsApp notification
    INSERT INTO public.workflow_steps (workflow_id, step_order, action_type, action_config, is_active)
    VALUES (
      reminder_workflow_id,
      1,
      'send_notification',
      jsonb_build_object(
        'template_id', template_id,
        'channels', ARRAY['sms', 'whatsapp'],
        'delay_minutes', 0
      ),
      true
    );
  END IF;
END;
$function$;

-- Update the organization setup function to include session reminder workflows
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_id uuid;
  pending_membership_exists boolean;
  user_invitation_id text;
BEGIN
  -- Get invitation ID from user metadata
  user_invitation_id := NEW.raw_user_meta_data ->> 'invitation_id';
  
  -- Check if this user has any pending memberships (was invited)
  SELECT public.user_has_pending_membership(NEW.id) INTO pending_membership_exists;
  
  -- Also check if user was created through invitation signup
  IF pending_membership_exists OR user_invitation_id IS NOT NULL THEN
    -- User was invited - don't create new org, just create working hours
    -- Standardize working hours (0=Sunday, 1=Monday, ..., 6=Saturday)
    INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
    VALUES 
      (NEW.id, 1, true, '09:00', '17:00'), -- Monday
      (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
      (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
      (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
      (NEW.id, 5, true, '09:00', '17:00'), -- Friday
      (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
      (NEW.id, 0, false, '09:00', '17:00'); -- Sunday
    
    RETURN NEW;
  END IF;

  -- User was not invited - create new organization
  INSERT INTO public.organizations (owner_id, name)
  VALUES (NEW.id, 'My Organization')
  RETURNING id INTO org_id;
  
  -- Create organization membership record as Owner
  INSERT INTO public.organization_members (organization_id, user_id, system_role, role, status)
  VALUES (org_id, NEW.id, 'Owner', 'Owner', 'active');
  
  -- Set this as the active organization in user settings
  PERFORM public.ensure_user_settings(NEW.id);
  UPDATE public.user_settings 
  SET active_organization_id = org_id 
  WHERE user_id = NEW.id;
  
  -- Create default working hours (standardized: 0=Sunday, 1=Monday, ..., 6=Saturday)
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
    (NEW.id, 0, false, '09:00', '17:00'); -- Sunday

  -- Seed default data for this organization with proper lifecycle values
  PERFORM public.ensure_default_packages_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_project_types_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_lead_statuses_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_project_statuses_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_session_statuses(NEW.id);
  PERFORM public.ensure_default_lead_field_definitions(org_id, NEW.id);
  PERFORM public.ensure_default_message_templates(NEW.id, org_id);
  PERFORM public.ensure_default_session_reminder_workflows(NEW.id, org_id);
  
  RETURN NEW;
END;
$function$;