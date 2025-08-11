-- Add previous_status_id to projects to support archive/restore
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS previous_status_id uuid;

-- Optional reference to project_statuses (kept nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = 'projects_previous_status_id_fkey'
      AND tc.table_name = 'projects'
  ) THEN
    ALTER TABLE public.projects
    ADD CONSTRAINT projects_previous_status_id_fkey
    FOREIGN KEY (previous_status_id)
    REFERENCES public.project_statuses (id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_previous_status_id ON public.projects(previous_status_id);
