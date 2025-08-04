-- Add projectId column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN project_id UUID;

-- Add foreign key relationship (optional, since project_id can be null)
-- This will help maintain data integrity
ALTER TABLE public.sessions 
ADD CONSTRAINT fk_sessions_project_id 
FOREIGN KEY (project_id) REFERENCES public.projects(id) 
ON DELETE SET NULL;