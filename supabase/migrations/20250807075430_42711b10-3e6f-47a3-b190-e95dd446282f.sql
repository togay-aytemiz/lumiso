-- Create function to automatically set up default system statuses for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_lead_statuses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Create the two required system statuses for the new user
  INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
  VALUES 
    (NEW.id, 'Completed', '#22c55e', true, 1000),
    (NEW.id, 'Lost', '#ef4444', true, 1001);
  
  -- Create default custom statuses for better user experience
  INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order, is_default)
  VALUES 
    (NEW.id, 'New', '#A0AEC0', false, 1, true),
    (NEW.id, 'Contacted', '#4299E1', false, 2, false),
    (NEW.id, 'Qualified', '#48BB78', false, 3, false),
    (NEW.id, 'Booked', '#9F7AEA', false, 4, false),
    (NEW.id, 'Not Interested', '#F56565', false, 5, false);
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically set up lead statuses for new users
DROP TRIGGER IF EXISTS on_auth_user_created_lead_statuses ON auth.users;
CREATE TRIGGER on_auth_user_created_lead_statuses
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_lead_statuses();

-- Update the ensure_system_lead_statuses function to only check if system statuses exist
-- and create them with standard names if missing (for existing users)
CREATE OR REPLACE FUNCTION public.ensure_system_lead_statuses(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  system_status_count INTEGER;
  completed_status_id UUID;
  lost_status_id UUID;
BEGIN
  -- Count existing system statuses for this user
  SELECT COUNT(*) INTO system_status_count 
  FROM public.lead_statuses 
  WHERE user_id = user_uuid AND is_system_final = true;
  
  -- If we already have 2 system statuses, don't create more
  IF system_status_count >= 2 THEN
    RETURN;
  END IF;
  
  -- Check for existing completed-type status
  SELECT id INTO completed_status_id 
  FROM public.lead_statuses 
  WHERE user_id = user_uuid AND is_system_final = true 
  AND color = '#22c55e'  -- Green color for completed
  LIMIT 1;
  
  -- Check for existing lost-type status  
  SELECT id INTO lost_status_id 
  FROM public.lead_statuses 
  WHERE user_id = user_uuid AND is_system_final = true 
  AND color = '#ef4444'  -- Red color for lost
  LIMIT 1;
  
  -- Only create if they don't exist (with standard names)
  IF completed_status_id IS NULL THEN
    INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
    VALUES (user_uuid, 'Completed', '#22c55e', true, 1000);
  END IF;
  
  IF lost_status_id IS NULL THEN
    INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
    VALUES (user_uuid, 'Lost', '#ef4444', true, 1001);
  END IF;
END;
$function$;