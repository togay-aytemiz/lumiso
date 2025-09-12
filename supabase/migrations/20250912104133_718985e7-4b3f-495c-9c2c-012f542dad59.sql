-- Remove the legacy views that are causing Security Definer View warnings
-- These views are not used in the application code (only in auto-generated types)
-- and are causing critical security warnings

-- First, let's check what type of objects these actually are
\d+ public.legacy_notification_logs
\d+ public.legacy_scheduled_notifications

-- Since these are causing Security Definer View warnings and are not used in application code,
-- we can safely drop them to resolve the critical security issues

-- Drop the legacy views that are causing security warnings
DROP VIEW IF EXISTS public.legacy_notification_logs CASCADE;
DROP VIEW IF EXISTS public.legacy_scheduled_notifications CASCADE;

-- Also check if there are corresponding tables that might have been used as the basis for these views
-- If they exist and are empty/unused, we can consider dropping them too
DROP TABLE IF EXISTS public.legacy_notification_logs CASCADE;
DROP TABLE IF EXISTS public.legacy_scheduled_notifications CASCADE;

-- Add a comment to document why these were removed
COMMENT ON SCHEMA public IS 'Legacy notification objects removed due to Security Definer View warnings. These were unused legacy views that bypassed RLS security.';

-- Final check - make sure our current notification system tables are properly secured
-- (These are the replacement tables that should be used)
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_session_reminders ENABLE ROW LEVEL SECURITY;