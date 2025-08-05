-- Add sort_order column to project_statuses table
ALTER TABLE public.project_statuses 
ADD COLUMN sort_order INTEGER;

-- Update existing records with sort_order based on created_at
UPDATE public.project_statuses 
SET sort_order = row_number() OVER (PARTITION BY user_id ORDER BY created_at);

-- Make sort_order NOT NULL after setting values
ALTER TABLE public.project_statuses 
ALTER COLUMN sort_order SET NOT NULL;

-- Add default value for new records
ALTER TABLE public.project_statuses 
ALTER COLUMN sort_order SET DEFAULT 1;