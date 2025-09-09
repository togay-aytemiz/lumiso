-- Fix duplicate session workflow triggers
-- Keep only one comprehensive trigger for sessions

-- Drop all duplicate triggers
DROP TRIGGER IF EXISTS session_workflow_trigger ON public.sessions;
DROP TRIGGER IF EXISTS sessions_workflow_trigger ON public.sessions;
DROP TRIGGER IF EXISTS trigger_session_scheduled ON public.sessions;
DROP TRIGGER IF EXISTS trigger_session_workflows ON public.sessions;
DROP TRIGGER IF EXISTS trigger_session_updated ON public.sessions;

-- Create a single, comprehensive trigger for session workflows
-- This trigger will handle INSERT (session_scheduled) and UPDATE with status changes
CREATE TRIGGER sessions_workflow_trigger 
    AFTER INSERT OR UPDATE ON public.sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_session_workflows();

-- Add helpful comment
COMMENT ON TRIGGER sessions_workflow_trigger ON public.sessions IS 'Single comprehensive trigger for session workflow events - handles session_scheduled (INSERT) and session status changes (UPDATE)';