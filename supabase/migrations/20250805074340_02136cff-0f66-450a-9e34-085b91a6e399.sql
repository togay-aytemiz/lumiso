-- Add status_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN status_id UUID REFERENCES public.project_statuses(id);

-- Create function to get default project status
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
$$ LANGUAGE plpgsql SECURITY DEFINER;