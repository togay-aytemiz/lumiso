-- Prevent duplicate pending invites per org+email
CREATE UNIQUE INDEX IF NOT EXISTS invitations_unique_pending
ON public.invitations (organization_id, lower(email))
WHERE accepted_at IS NULL AND expires_at > now();

-- Update handle_new_user_organization to use UPSERT for working hours
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_id uuid;
  pending_membership_exists boolean;
BEGIN
  -- Check if this user has any pending memberships (was invited)
  SELECT public.user_has_pending_membership(NEW.id) INTO pending_membership_exists;
  
  IF pending_membership_exists THEN
    -- User was invited - don't create new org, just create working hours
    -- Standardize working hours (0=Sunday, 1=Monday, ..., 6=Saturday) using UPSERT
    INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
    VALUES 
      (NEW.id, 1, true, '09:00', '17:00'), -- Monday
      (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
      (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
      (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
      (NEW.id, 5, true, '09:00', '17:00'), -- Friday
      (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
      (NEW.id, 0, false, '09:00', '17:00') -- Sunday
    ON CONFLICT (user_id, day_of_week) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time;
    
    RETURN NEW;
  END IF;

  -- User was not invited - create new organization
  INSERT INTO public.organizations (owner_id, name)
  VALUES (NEW.id, 'My Organization')
  RETURNING id INTO org_id;
  
  -- Create organization membership record as Owner
  INSERT INTO public.organization_members (organization_id, user_id, system_role, status)
  VALUES (org_id, NEW.id, 'Owner', 'active');
  
  -- Set this as the active organization in user settings
  PERFORM public.ensure_user_settings(NEW.id);
  UPDATE public.user_settings 
  SET active_organization_id = org_id 
  WHERE user_id = NEW.id;
  
  -- Create default working hours using UPSERT (standardized: 0=Sunday, 1=Monday, ..., 6=Saturday)
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
    (NEW.id, 0, false, '09:00', '17:00') -- Sunday
  ON CONFLICT (user_id, day_of_week) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time;

  -- Seed default packages and services for this organization
  PERFORM public.ensure_default_packages_for_org(NEW.id, org_id);
  
  RETURN NEW;
END;
$function$;