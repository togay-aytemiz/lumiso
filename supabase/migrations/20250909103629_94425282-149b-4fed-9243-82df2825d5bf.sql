-- Create trigger on sessions table to call workflow executor when session is created
CREATE TRIGGER trigger_session_scheduled
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_session_workflows();

-- Also create trigger for session updates (for rescheduled workflows)
CREATE TRIGGER trigger_session_updated
  AFTER UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_session_workflows();