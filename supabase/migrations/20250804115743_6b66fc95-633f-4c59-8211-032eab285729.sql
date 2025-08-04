-- Remove the function and trigger that enforces one planned session per lead with CASCADE
DROP FUNCTION IF EXISTS public.check_planned_session_limit() CASCADE;