-- Fix reset guided setup to show onboarding modal
CREATE OR REPLACE FUNCTION public.reset_guided_setup(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.user_settings 
  SET 
    in_guided_setup = false,  -- Changed to false so modal shows
    guided_setup_skipped = false,
    guidance_completed = false,
    current_step = 1,
    completed_steps = '[]'::jsonb
  WHERE user_id = user_uuid;
END;
$$;