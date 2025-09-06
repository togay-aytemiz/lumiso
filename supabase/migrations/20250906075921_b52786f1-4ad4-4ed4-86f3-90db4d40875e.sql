-- Clean up notification system by removing duplicate and weekly recap columns

-- 1. Remove duplicate notification columns from organization_settings
ALTER TABLE organization_settings 
DROP COLUMN IF EXISTS notification_daily_summary_send_at,
DROP COLUMN IF EXISTS notification_weekly_recap_send_at,
DROP COLUMN IF EXISTS notification_scheduled_time,
DROP COLUMN IF EXISTS notification_weekly_recap_enabled;

-- 2. Remove weekly recap columns from user_settings  
ALTER TABLE user_settings
DROP COLUMN IF EXISTS notification_weekly_recap_enabled,
DROP COLUMN IF EXISTS notification_weekly_recap_send_at;

-- 3. Remove daily_summary_send_at since we have notification_scheduled_time
ALTER TABLE user_settings
DROP COLUMN IF EXISTS notification_daily_summary_send_at;

-- 4. Update ensure_user_settings function to remove weekly recap defaults
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
      '09:00'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$function$;

-- 5. Update ensure_organization_settings function to remove notification columns entirely
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
      primary_brand_color
    ) VALUES (
      org_id,
      'DD/MM/YYYY',
      '12-hour',
      '',
      '#1EB29F'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$function$;