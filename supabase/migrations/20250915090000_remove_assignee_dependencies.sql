-- Remove legacy assignee-based triggers and functions for single photographer mode

-- Drop old notification triggers that referenced the removed assignees columns
DROP TRIGGER IF EXISTS notify_new_lead_assignees ON public.leads;
DROP TRIGGER IF EXISTS notify_new_project_assignees ON public.projects;

-- Drop helper functions that depended on the assignees arrays
DROP FUNCTION IF EXISTS public.detect_new_lead_assignees();
DROP FUNCTION IF EXISTS public.detect_new_project_assignees();

-- Drop any remaining milestone trigger that relied on the legacy function
DROP TRIGGER IF EXISTS project_milestone_trigger ON public.projects;

-- Replace milestone notification trigger function with a no-op that simply preserves the row.
-- In single photographer mode, we surface milestone information through the application UI instead.
DROP FUNCTION IF EXISTS public.log_project_milestone_changes();
CREATE OR REPLACE FUNCTION public.log_project_milestone_changes()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
