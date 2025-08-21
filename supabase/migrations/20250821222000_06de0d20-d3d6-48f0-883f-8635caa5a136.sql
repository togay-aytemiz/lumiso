-- Fix the complete_onboarding_step function to allow steps beyond 5
-- and remove automatic guided mode completion logic
CREATE OR REPLACE FUNCTION public.complete_onboarding_step(user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Simply increment the counter without capping it
  UPDATE public.user_settings 
  SET 
    completed_steps_count = completed_steps_count + 1
  WHERE user_id = user_uuid;
  
  -- Create settings if they don't exist
  INSERT INTO public.user_settings (
    user_id, 
    completed_steps_count,
    in_guided_setup,
    guidance_completed
  ) 
  SELECT user_uuid, 1, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = user_uuid);
END;
$function$;