-- Fix invite flow: Prevent invited users from creating their own organization
-- Update the trigger function to check if user was invited
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if this user was invited (has invited=true in user_metadata)
  -- If they were invited, skip creating their own organization since they'll be added to the inviter's organization
  IF (NEW.raw_user_meta_data->>'invited')::boolean = true THEN
    -- Still create the default data but no organization membership
    -- Create default working hours (Monday to Friday enabled, 9 AM to 5 PM)
    INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
    VALUES 
      (NEW.id, 1, true, '09:00', '17:00'), -- Monday
      (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
      (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
      (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
      (NEW.id, 5, true, '09:00', '17:00'), -- Friday
      (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
      (NEW.id, 0, false, '09:00', '17:00'); -- Sunday

    -- Create default packages
    PERFORM public.ensure_default_packages(NEW.id);
    
    -- Create default services
    PERFORM public.ensure_default_services(NEW.id);
    
    RETURN NEW;
  END IF;

  -- For non-invited users, create organization member record for new user as Owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'Owner');
  
  -- Create default working hours (Monday to Friday enabled, 9 AM to 5 PM)
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
    (NEW.id, 0, false, '09:00', '17:00'); -- Sunday

  -- Create default packages
  PERFORM public.ensure_default_packages(NEW.id);
  
  -- Create default services
  PERFORM public.ensure_default_services(NEW.id);
  
  RETURN NEW;
END;
$$;