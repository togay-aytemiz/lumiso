-- Clean up duplicate system statuses and ensure only 2 exist
-- First, let's clean up any existing duplicates and reset to exactly 2 system statuses

-- Remove all existing system statuses first
DELETE FROM public.lead_statuses WHERE is_system_final = true;

-- Now recreate the ensure function to properly handle conflicts
CREATE OR REPLACE FUNCTION public.ensure_system_lead_statuses(user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  completed_count INTEGER;
  lost_count INTEGER;
BEGIN
  -- Check if system statuses already exist for this user
  SELECT COUNT(*) INTO completed_count 
  FROM public.lead_statuses 
  WHERE user_id = user_uuid AND is_system_final = true AND name ILIKE '%completed%';
  
  SELECT COUNT(*) INTO lost_count 
  FROM public.lead_statuses 
  WHERE user_id = user_uuid AND is_system_final = true AND name ILIKE '%lost%';
  
  -- Only create if they don't exist
  IF completed_count = 0 THEN
    INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
    VALUES (user_uuid, 'Completed', '#22c55e', true, 1000);
  END IF;
  
  IF lost_count = 0 THEN
    INSERT INTO public.lead_statuses (user_id, name, color, is_system_final, sort_order)
    VALUES (user_uuid, 'Lost', '#ef4444', true, 1001);
  END IF;
END;
$function$

-- Run the function for all existing users to clean up their system statuses
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT user_id FROM public.lead_statuses 
    LOOP
        PERFORM public.ensure_system_lead_statuses(user_record.user_id);
    END LOOP;
END $$;