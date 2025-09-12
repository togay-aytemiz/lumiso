-- Investigate the legacy objects that are causing Security Definer View warnings
-- Check if these are actually views or if there's something special about them

-- Get detailed information about these objects
SELECT 
    schemaname,
    viewname,
    viewowner,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
    AND viewname IN ('legacy_notification_logs', 'legacy_scheduled_notifications');

-- Check if these are both tables and views (which would be problematic)
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('legacy_notification_logs', 'legacy_scheduled_notifications');

-- Since these legacy objects might be causing security issues and appear unused,
-- let's check if they have any data or dependencies
SELECT 
    'legacy_notification_logs' as table_name,
    COUNT(*) as row_count
FROM public.legacy_notification_logs
UNION ALL
SELECT 
    'legacy_scheduled_notifications' as table_name,
    COUNT(*) as row_count  
FROM public.legacy_scheduled_notifications;

-- Check for any dependencies on these legacy objects
SELECT 
    dependent_ns.nspname as dependent_schema,
    dependent_view.relname as dependent_view,
    source_ns.nspname as source_schema,
    source_table.relname as source_table
FROM pg_depend 
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
WHERE source_ns.nspname = 'public' 
    AND source_table.relname IN ('legacy_notification_logs', 'legacy_scheduled_notifications');