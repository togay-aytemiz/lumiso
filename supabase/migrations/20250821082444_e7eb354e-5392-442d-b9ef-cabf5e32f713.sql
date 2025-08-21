-- Add guided setup step tracking fields to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN current_step integer DEFAULT 1,
ADD COLUMN completed_steps jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.user_settings.current_step IS 'Current step in guided setup (1-5)';
COMMENT ON COLUMN public.user_settings.completed_steps IS 'Array of completed step numbers';

-- Create function to advance guided setup step
CREATE OR REPLACE FUNCTION public.advance_guided_step(user_uuid uuid, step_number integer, skip_step boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_completed_steps jsonb;
  new_completed_steps jsonb;
  next_step integer;
  total_steps integer := 5;
BEGIN
  -- Get current completed steps
  SELECT completed_steps, current_step INTO current_completed_steps, next_step
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
  next_step := 1;
  FOR i IN 1..total_steps LOOP
    IF NOT (new_completed_steps ? i::text) THEN
      next_step := i;
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
      current_step = next_step
    WHERE user_id = user_uuid;
  END IF;
END;
$function$;

-- Create function to reset guided setup for developers
CREATE OR REPLACE FUNCTION public.reset_guided_setup(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_settings 
  SET 
    in_guided_setup = true,
    guided_setup_skipped = false,
    guidance_completed = false,
    current_step = 1,
    completed_steps = '[]'::jsonb
  WHERE user_id = user_uuid;
END;
$function$;

-- Create function to jump to specific step for developers
CREATE OR REPLACE FUNCTION public.set_guided_step(user_uuid uuid, target_step integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  completed_array jsonb := '[]'::jsonb;
BEGIN
  -- Create completed steps array for all steps before target
  FOR i IN 1..(target_step - 1) LOOP
    completed_array := completed_array || jsonb_build_array(i);
  END LOOP;
  
  UPDATE public.user_settings 
  SET 
    in_guided_setup = true,
    guided_setup_skipped = false,
    guidance_completed = false,
    current_step = target_step,
    completed_steps = completed_array
  WHERE user_id = user_uuid;
END;
$function$;