-- Update existing projects to have default status
UPDATE public.projects 
SET status_id = public.get_default_project_status(user_id) 
WHERE status_id IS NULL;