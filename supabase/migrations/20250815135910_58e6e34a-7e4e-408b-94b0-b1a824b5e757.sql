-- Fix the trigger function to properly handle default switching
CREATE OR REPLACE FUNCTION public.ensure_single_default_project_type()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If setting this type as default
  IF NEW.is_default = true THEN
    -- Unset all other defaults for this user BEFORE setting this one
    UPDATE public.project_types 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
  END IF;
  
  -- If this is an UPDATE and we're trying to remove the default
  -- Only prevent it if this is the ONLY default and there are other types available
  IF TG_OP = 'UPDATE' AND OLD.is_default = true AND NEW.is_default = false THEN
    -- Check if this is the only default and there are other project types
    IF NOT EXISTS (
      SELECT 1 FROM public.project_types 
      WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true
    ) AND EXISTS (
      SELECT 1 FROM public.project_types 
      WHERE user_id = NEW.user_id AND id != NEW.id
    ) THEN
      -- Don't allow removing the last default if there are other types
      RAISE EXCEPTION 'There must always be one default project type';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;