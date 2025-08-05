-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.ensure_single_default_project_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Set all other types for this user to non-default
    UPDATE public.project_types 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  -- If this was the only default and we're setting it to false, prevent it
  IF OLD.is_default = true AND NEW.is_default = false THEN
    -- Check if there are other defaults
    IF NOT EXISTS (
      SELECT 1 FROM public.project_types 
      WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true
    ) THEN
      RAISE EXCEPTION 'There must always be one default project type';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger to ensure single default
CREATE TRIGGER ensure_single_default_project_type_trigger
BEFORE UPDATE ON public.project_types
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_project_type();