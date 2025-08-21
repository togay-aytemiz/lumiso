-- Add simple progress tracking column
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS completed_steps_count integer DEFAULT 0;

-- Simple function to increment progress
CREATE OR REPLACE FUNCTION public.complete_onboarding_step(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Just increment the counter
  UPDATE public.user_settings 
  SET 
    completed_steps_count = LEAST(completed_steps_count + 1, 5),
    guidance_completed = (completed_steps_count + 1 >= 5),
    in_guided_setup = (completed_steps_count + 1 < 5)
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
$$;