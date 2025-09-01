-- Create trigger to detect project milestone changes
DROP TRIGGER IF EXISTS project_milestone_trigger ON public.projects;

CREATE TRIGGER project_milestone_trigger
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_milestone_changes();