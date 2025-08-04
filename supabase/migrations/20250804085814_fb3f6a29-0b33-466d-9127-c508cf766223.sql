-- Add project_id column to activities table
ALTER TABLE public.activities 
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;