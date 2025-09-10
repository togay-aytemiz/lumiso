-- Drop the broken trigger that uses non-existent functions
DROP TRIGGER IF EXISTS sessions_workflow_trigger ON public.sessions;
DROP FUNCTION IF EXISTS public.trigger_session_workflows();

-- We'll rely on frontend triggering instead of database triggers
-- since supabase_url() and supabase_service_role_key() functions no longer exist