-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.get_default_project_status(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  default_status_id UUID;
BEGIN
  -- First try to find "Planned" status
  SELECT id INTO default_status_id 
  FROM public.project_statuses 
  WHERE user_id = user_uuid AND LOWER(name) = 'planned'
  LIMIT 1;
  
  -- If "Planned" doesn't exist, get the first available status
  IF default_status_id IS NULL THEN
    SELECT id INTO default_status_id 
    FROM public.project_statuses 
    WHERE user_id = user_uuid 
    ORDER BY created_at ASC 
    LIMIT 1;
  END IF;
  
  RETURN default_status_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';