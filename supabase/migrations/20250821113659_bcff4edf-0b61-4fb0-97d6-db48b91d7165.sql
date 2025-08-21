-- Fix the advance_guided_step function with clearer variable naming
CREATE OR REPLACE FUNCTION public.advance_guided_step(user_uuid uuid, step_number integer, skip_step boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_completed_steps jsonb;
  new_completed_steps jsonb;
  calculated_next_step integer;
  total_steps integer := 5;
BEGIN
  -- Get current completed steps
  SELECT completed_steps INTO current_completed_steps
  FROM public.user_settings
  WHERE user_id = user_uuid;
  
  -- Initialize if null
  IF current_completed_steps IS NULL THEN
    current_completed_steps := '[]'::jsonb;
  END IF;
  
  -- Add the completed step if not already present
  IF NOT (current_completed_steps ? step_number::text) THEN
    new_completed_steps := current_completed_steps || jsonb_build_array(step_number);
  ELSE
    new_completed_steps := current_completed_steps;
  END IF;
  
  -- Calculate next step (find lowest incomplete step)
  calculated_next_step := total_steps + 1; -- Default to beyond last step
  FOR i IN 1..total_steps LOOP
    IF NOT (new_completed_steps ? i::text) THEN
      calculated_next_step := i;
      EXIT;
    END IF;
  END LOOP;
  
  -- If all steps completed, mark guidance as complete
  IF jsonb_array_length(new_completed_steps) >= total_steps THEN
    UPDATE public.user_settings 
    SET 
      completed_steps = new_completed_steps,
      current_step = total_steps + 1, -- Beyond last step
      guidance_completed = true,
      in_guided_setup = false
    WHERE user_id = user_uuid;
  ELSE
    UPDATE public.user_settings 
    SET 
      completed_steps = new_completed_steps,
      current_step = calculated_next_step
    WHERE user_id = user_uuid;
  END IF;
END;
$$;