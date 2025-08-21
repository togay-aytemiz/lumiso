-- Completely rewrite the advance_guided_step function
CREATE OR REPLACE FUNCTION public.advance_guided_step(user_uuid uuid, step_number integer, skip_step boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_completed jsonb;
  new_completed jsonb;
  next_step_to_do integer;
BEGIN
  -- Get current completed steps
  SELECT COALESCE(completed_steps, '[]'::jsonb) INTO current_completed
  FROM public.user_settings
  WHERE user_id = user_uuid;
  
  -- Add this step to completed if not already there
  IF NOT (current_completed ? step_number::text) THEN
    new_completed := current_completed || jsonb_build_array(step_number);
  ELSE
    new_completed := current_completed;
  END IF;
  
  -- Find the next step that needs to be done (lowest incomplete step)
  next_step_to_do := 6; -- Default to finished (beyond step 5)
  FOR i IN 1..5 LOOP
    IF NOT (new_completed ? i::text) THEN
      next_step_to_do := i;
      EXIT;
    END IF;
  END LOOP;
  
  -- Update the user settings
  UPDATE public.user_settings 
  SET 
    completed_steps = new_completed,
    current_step = next_step_to_do,
    guidance_completed = (jsonb_array_length(new_completed) >= 5),
    in_guided_setup = (jsonb_array_length(new_completed) < 5)
  WHERE user_id = user_uuid;
END;
$$;