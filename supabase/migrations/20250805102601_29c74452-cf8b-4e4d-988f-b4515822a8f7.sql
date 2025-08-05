-- Create an improved trigger that also handles INSERT operations
DROP TRIGGER IF EXISTS ensure_single_default_project_type_trigger ON public.project_types;

-- Recreate the function with better logic
CREATE OR REPLACE FUNCTION public.ensure_single_default_project_type()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this type as default
  IF NEW.is_default = true THEN
    -- First unset all other defaults for this user
    UPDATE public.project_types 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  -- If this is an UPDATE and we're trying to remove the default
  IF TG_OP = 'UPDATE' AND OLD.is_default = true AND NEW.is_default = false THEN
    -- Check if there are other defaults
    IF NOT EXISTS (
      SELECT 1 FROM public.project_types 
      WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true
    ) THEN
      -- Don't allow removing the last default
      RAISE EXCEPTION 'There must always be one default project type';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create triggers for both INSERT and UPDATE
CREATE TRIGGER ensure_single_default_project_type_insert_trigger
BEFORE INSERT ON public.project_types
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_project_type();

CREATE TRIGGER ensure_single_default_project_type_update_trigger
BEFORE UPDATE ON public.project_types
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_project_type();