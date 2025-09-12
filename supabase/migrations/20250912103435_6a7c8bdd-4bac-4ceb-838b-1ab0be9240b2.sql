-- Fix the function that doesn't have SET search_path
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_channel_views()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.template_channel_views
  WHERE template_id NOT IN (
    SELECT id FROM public.message_templates
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Now try to identify views or functions that might be causing Security Definer View errors
-- Let's look for any views or rules that might have unusual definitions
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public'
    AND (
        lower(definition) LIKE '%definer%' OR 
        lower(definition) LIKE '%security%'
    )
LIMIT 10;

-- Check for any RLS policies or rules that might be causing issues
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
LIMIT 5;

-- Let's also check if there are any materialized views
SELECT 
    schemaname,
    matviewname,
    definition
FROM pg_matviews 
WHERE schemaname = 'public'
LIMIT 5;