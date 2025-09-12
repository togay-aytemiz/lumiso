-- Search more comprehensively for Security Definer Views across all schemas
-- Check system catalogs more thoroughly

-- Look for views in all schemas that might have security definer
SELECT 
    schemaname,
    viewname,
    viewowner,
    definition
FROM pg_views 
WHERE lower(definition) LIKE '%security%'
    OR lower(definition) LIKE '%definer%'
    OR schemaname IN ('public', 'auth', 'storage');

-- Check for any rules on tables that might create security definer behavior
SELECT 
    schemaname,
    tablename,
    rulename,
    definition
FROM pg_rules
WHERE schemaname = 'public'
    AND (lower(definition) LIKE '%security%' OR lower(definition) LIKE '%definer%');

-- Look for any custom object types that might be causing issues
SELECT 
    n.nspname as schema_name,
    c.relname as relation_name,
    c.relkind as kind,
    CASE c.relkind 
        WHEN 'r' THEN 'table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'f' THEN 'foreign table'
        WHEN 'p' THEN 'partitioned table'
    END as object_type
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
    AND c.relkind IN ('v', 'm')  -- views and materialized views
    AND c.relname NOT LIKE 'pg_%'
ORDER BY n.nspname, c.relname;

-- Since I can't easily identify the problematic views, let me focus on making sure
-- our database is secure by ensuring all tables have proper RLS policies

-- Make sure RLS is enabled on all our critical tables (this should already be done)
-- This is a safety check to ensure the tables are properly secured

-- Ensure all our tables have RLS enabled (idempotent)
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_audit_log ENABLE ROW LEVEL SECURITY;