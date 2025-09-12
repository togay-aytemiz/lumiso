-- Remove the legacy views that are causing Security Definer View warnings
-- These views are not used in the application code and are causing critical security warnings

-- Drop the legacy views/tables that are causing security warnings
-- Using CASCADE to handle any dependencies
DROP VIEW IF EXISTS public.legacy_notification_logs CASCADE;
DROP VIEW IF EXISTS public.legacy_scheduled_notifications CASCADE;

-- Also drop tables with the same names if they exist
DROP TABLE IF EXISTS public.legacy_notification_logs CASCADE;
DROP TABLE IF EXISTS public.legacy_scheduled_notifications CASCADE;

-- Ensure our current notification system tables are properly secured with RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_session_reminders ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled on key tables
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'notification_logs',
        'scheduled_session_reminders',
        'organization_members',
        'custom_roles',
        'role_permissions',
        'invitations',
        'invitation_audit_log'
    );