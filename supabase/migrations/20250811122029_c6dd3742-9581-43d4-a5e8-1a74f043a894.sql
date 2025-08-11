-- Add previous_status_id to projects to support archive/restore
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS previous_status_id UUID REFERENCES public.project_statuses(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_previous_status_id ON public.projects(previous_status_id);

-- Optional: comment for documentation
COMMENT ON COLUMN public.projects.previous_status_id IS 'Stores the previous status_id when a project is archived to allow restoration.';