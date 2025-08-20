-- Update ensure_default_session_statuses to include proper lifecycle values
CREATE OR REPLACE FUNCTION public.ensure_default_session_statuses(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cnt INTEGER;
  org_id UUID;
BEGIN
  -- Get user's active organization
  SELECT get_user_active_organization_id() INTO org_id;
  IF org_id IS NULL THEN
    RETURN; -- No organization found
  END IF;

  -- Check if organization already has session statuses
  SELECT COUNT(*) INTO cnt FROM public.session_statuses WHERE organization_id = org_id;
  
  IF cnt = 0 THEN
    INSERT INTO public.session_statuses (user_id, organization_id, name, color, sort_order, is_system_initial, lifecycle, is_system_required) VALUES
      (user_uuid, org_id, 'Planned',   '#A0AEC0', 1, true, 'active', true),
      (user_uuid, org_id, 'Confirmed', '#ECC94B', 2, false, 'active', false),
      (user_uuid, org_id, 'Editing',   '#9F7AEA', 3, false, 'active', false),
      (user_uuid, org_id, 'Delivered', '#4299E1', 4, false, 'completed', false),
      (user_uuid, org_id, 'Completed', '#48BB78', 5, false, 'completed', false),
      (user_uuid, org_id, 'Cancelled', '#F56565', 6, false, 'cancelled', false);
  END IF;
END;
$function$;

-- Update ensure_system_lead_statuses to include proper lifecycle values  
CREATE OR REPLACE FUNCTION public.ensure_system_lead_statuses(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  system_status_count INTEGER;
  completed_status_id UUID;
  lost_status_id UUID;
  org_id UUID;
BEGIN
  -- Get user's active organization
  SELECT get_user_active_organization_id() INTO org_id;
  IF org_id IS NULL THEN
    RETURN; -- No organization found
  END IF;

  -- Count existing system statuses for this organization
  SELECT COUNT(*) INTO system_status_count 
  FROM public.lead_statuses 
  WHERE organization_id = org_id AND is_system_final = true;
  
  -- If we already have 2 system statuses, don't create more
  IF system_status_count >= 2 THEN
    RETURN;
  END IF;
  
  -- Check for existing completed-type status
  SELECT id INTO completed_status_id 
  FROM public.lead_statuses 
  WHERE organization_id = org_id AND is_system_final = true 
  AND color = '#22c55e'  -- Green color for completed
  LIMIT 1;
  
  -- Check for existing lost-type status  
  SELECT id INTO lost_status_id 
  FROM public.lead_statuses 
  WHERE organization_id = org_id AND is_system_final = true 
  AND color = '#ef4444'  -- Red color for lost
  LIMIT 1;
  
  -- Only create if they don't exist (with proper lifecycle values)
  IF completed_status_id IS NULL THEN
    INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, lifecycle)
    VALUES (user_uuid, org_id, 'Completed', '#22c55e', true, 1000, 'completed');
  END IF;
  
  IF lost_status_id IS NULL THEN
    INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, lifecycle)
    VALUES (user_uuid, org_id, 'Lost', '#ef4444', true, 1001, 'cancelled');
  END IF;
END;
$function$;

-- Create new function to ensure default lead statuses for new organizations
CREATE OR REPLACE FUNCTION public.ensure_default_lead_statuses_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  status_count INTEGER;
BEGIN
  -- Check if organization already has lead statuses (idempotent check)
  SELECT COUNT(*) INTO status_count 
  FROM public.lead_statuses 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no statuses exist for this organization
  IF status_count = 0 THEN
    -- Create default lead statuses with proper lifecycle values
    INSERT INTO public.lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, is_default, lifecycle, is_system_required) VALUES
      (user_uuid, org_id, 'New', '#A0AEC0', false, 1, true, 'active', true),
      (user_uuid, org_id, 'Contacted', '#4299E1', false, 2, false, 'active', false),
      (user_uuid, org_id, 'Qualified', '#48BB78', false, 3, false, 'active', false),
      (user_uuid, org_id, 'Booked', '#9F7AEA', false, 4, false, 'active', false),
      (user_uuid, org_id, 'Not Interested', '#F56565', false, 5, false, 'cancelled', false),
      (user_uuid, org_id, 'Completed', '#22c55e', true, 1000, false, 'completed', false),
      (user_uuid, org_id, 'Lost', '#ef4444', true, 1001, false, 'cancelled', false);
  END IF;
END;
$function$;

-- Create new function to ensure default project statuses for new organizations
CREATE OR REPLACE FUNCTION public.ensure_default_project_statuses_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  status_count INTEGER;
BEGIN
  -- Check if organization already has project statuses
  SELECT COUNT(*) INTO status_count 
  FROM public.project_statuses 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no statuses exist for this organization
  IF status_count = 0 THEN
    INSERT INTO public.project_statuses (user_id, organization_id, name, color, sort_order, lifecycle, is_system_required) VALUES
      (user_uuid, org_id, 'Planned', '#A0AEC0', 1, 'active', true),
      (user_uuid, org_id, 'In Progress', '#4299E1', 2, 'active', false),
      (user_uuid, org_id, 'On Hold', '#ECC94B', 3, 'active', false),
      (user_uuid, org_id, 'Completed', '#48BB78', 4, 'completed', false),
      (user_uuid, org_id, 'Cancelled', '#F56565', 5, 'cancelled', false);
  END IF;
END;
$function$;

-- Update the main user organization handler to call the new seeding functions
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
  
  RETURN NEW;
END;
$function$;