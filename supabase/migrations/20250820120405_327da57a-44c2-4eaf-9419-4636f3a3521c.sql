-- Simplify notifications to 3 core types for MVP
-- This migration removes old notification columns and adds new simplified ones

-- Update user_settings table
ALTER TABLE public.user_settings 
DROP COLUMN IF EXISTS notification_overdue_reminder_enabled,
DROP COLUMN IF EXISTS notification_delivery_reminder_enabled,
DROP COLUMN IF EXISTS notification_session_reminder_enabled,
DROP COLUMN IF EXISTS notification_task_nudge_enabled,
DROP COLUMN IF EXISTS notification_integration_failure_alert_enabled,
DROP COLUMN IF EXISTS notification_team_invite_accepted_alert_enabled,
DROP COLUMN IF EXISTS notification_lead_conversion_enabled,
DROP COLUMN IF EXISTS notification_delivery_reminder_send_at,
DROP COLUMN IF EXISTS notification_session_reminder_send_at;

-- Add new simplified notification columns to user settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS notification_daily_summary_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_weekly_recap_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_new_assignment_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_project_milestone_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_global_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_scheduled_time text DEFAULT '09:00';

-- Update organization_settings table  
ALTER TABLE public.organization_settings
DROP COLUMN IF EXISTS notification_overdue_reminder_enabled,
DROP COLUMN IF EXISTS notification_delivery_reminder_enabled,
DROP COLUMN IF EXISTS notification_session_reminder_enabled,
DROP COLUMN IF EXISTS notification_task_nudge_enabled,
DROP COLUMN IF EXISTS notification_integration_failure_alert_enabled,
DROP COLUMN IF EXISTS notification_team_invite_accepted_alert_enabled,
DROP COLUMN IF EXISTS notification_lead_conversion_enabled,
DROP COLUMN IF EXISTS notification_delivery_reminder_send_at,
DROP COLUMN IF EXISTS notification_session_reminder_send_at;

-- Add new simplified notification columns to organization settings
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS notification_daily_summary_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_weekly_recap_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_new_assignment_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_project_milestone_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_global_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_scheduled_time text DEFAULT '09:00';

-- Update the ensure_user_settings function to use new simplified structure
CREATE OR REPLACE FUNCTION public.ensure_user_settings(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  settings_id uuid;
BEGIN
  -- Try to get existing settings
  SELECT id INTO settings_id
  FROM public.user_settings
  WHERE user_id = user_uuid;
  
  -- Create default settings if they don't exist
  IF settings_id IS NULL THEN
    INSERT INTO public.user_settings (
      user_id, 
      show_quick_status_buttons,
      photography_business_name,
      logo_url,
      primary_brand_color,
      date_format,
      time_format,
      notification_global_enabled,
      notification_daily_summary_enabled,
      notification_weekly_recap_enabled,
      notification_new_assignment_enabled,
      notification_project_milestone_enabled,
      notification_scheduled_time
    ) VALUES (
      user_uuid,
      true,
      '',
      null,
      '#1EB29F',
      'DD/MM/YYYY',
      '12-hour',
      true,
      true,
      true,
      true,
      true,
      '09:00'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$function$;

-- Update the ensure_organization_settings function to use new simplified structure
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  settings_id uuid;
BEGIN
  -- Try to get existing settings first
  SELECT id INTO settings_id
  FROM public.organization_settings
  WHERE organization_id = org_id;
  
  -- Only create if none exist
  IF settings_id IS NULL THEN
    INSERT INTO public.organization_settings (
      organization_id,
      date_format,
      time_format,
      photography_business_name,
      primary_brand_color,
      notification_global_enabled,
      notification_daily_summary_enabled,
      notification_weekly_recap_enabled,
      notification_new_assignment_enabled,
      notification_project_milestone_enabled,
      notification_scheduled_time
    ) VALUES (
      org_id,
      'DD/MM/YYYY',
      '12-hour',
      '',
      '#1EB29F',
      true,
      true,
      true,
      true,
      true,
      '09:00'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$function$;