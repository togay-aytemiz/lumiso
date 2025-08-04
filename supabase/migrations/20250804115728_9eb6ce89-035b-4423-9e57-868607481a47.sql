-- Remove the trigger that enforces one planned session per lead
DROP TRIGGER IF EXISTS check_planned_session_limit_trigger ON public.sessions;

-- Remove the function that checks planned session limit
DROP FUNCTION IF EXISTS public.check_planned_session_limit();