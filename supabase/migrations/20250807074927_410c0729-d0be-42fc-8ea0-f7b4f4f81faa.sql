-- Fix the ensure_system_lead_statuses function to prevent duplicates
-- and ensure only exactly 2 system statuses exist per user

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
  
  -- Only create if they don't exist
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