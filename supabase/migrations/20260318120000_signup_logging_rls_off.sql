-- Disable RLS on the signup debug table while we diagnose the issue.
ALTER TABLE public.signup_debug_logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read signup debug logs" ON public.signup_debug_logs;
