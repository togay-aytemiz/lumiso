-- Resolve Supabase Security Advisor rls_disabled_in_public for the temporary
-- signup diagnostics table. The signup triggers no longer write to this table,
-- so remove any production remnant left behind by skipped or partial deploys.

DROP TABLE IF EXISTS public.signup_debug_logs;
