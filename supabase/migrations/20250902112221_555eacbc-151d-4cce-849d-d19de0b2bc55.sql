-- Add sort_order column to projects table
ALTER TABLE public.projects 
ADD COLUMN sort_order INTEGER;

-- Set default sort_order values based on created_at for existing projects
UPDATE public.projects 
SET sort_order = sub.row_number 
FROM (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY organization_id, status_id ORDER BY created_at) as row_number
  FROM public.projects
) sub 
WHERE public.projects.id = sub.id;

-- Set default value for new projects
ALTER TABLE public.projects 
ALTER COLUMN sort_order SET DEFAULT 1;

-- Add index for better performance
CREATE INDEX idx_projects_sort_order ON public.projects(organization_id, status_id, sort_order);