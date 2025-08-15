-- First, fix any existing data by ensuring only one default exists
-- Keep the earliest created default and unset others
WITH first_default AS (
  SELECT user_id, 
         (array_agg(id ORDER BY created_at ASC))[1] as keep_id
  FROM project_types 
  WHERE is_default = true
  GROUP BY user_id
  HAVING COUNT(*) > 1
)
UPDATE project_types 
SET is_default = false 
WHERE is_default = true 
  AND id NOT IN (SELECT keep_id FROM first_default)
  AND user_id IN (SELECT user_id FROM first_default);

-- Drop the existing trigger and function if they exist
DROP TRIGGER IF EXISTS ensure_single_default_project_type_trigger ON project_types;
DROP FUNCTION IF EXISTS ensure_single_default_project_type();

-- Create an improved function to ensure single default
CREATE OR REPLACE FUNCTION public.ensure_single_default_project_type()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this type as default
  IF NEW.is_default = true THEN
    -- Unset all other defaults for this user BEFORE setting this one
    UPDATE public.project_types 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
  END IF;
  
  -- If this is an UPDATE and we're trying to remove the default
  IF TG_OP = 'UPDATE' AND OLD.is_default = true AND NEW.is_default = false THEN
    -- Check if there are other defaults after this change
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER ensure_single_default_project_type_trigger
  BEFORE INSERT OR UPDATE ON project_types
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_project_type();