-- Let's check if there are pending memberships without proper roles first
SELECT id, user_id, organization_id, system_role, role, status 
FROM organization_members 
WHERE role IS NULL OR role = '';

-- Fix the handle_new_user_organization function to properly handle invited users
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

  -- Seed default packages and services for this organization
  PERFORM public.ensure_default_packages_for_org(NEW.id, org_id);
  
  RETURN NEW;
END;
$$;