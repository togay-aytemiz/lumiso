-- Update existing users to have all notifications enabled by default and set time to 09:00
UPDATE public.user_settings 
SET 
  notification_overdue_reminder_enabled = true,
  notification_delivery_reminder_enabled = true,
  notification_session_reminder_enabled = true,
  notification_daily_summary_enabled = true,
  notification_task_nudge_enabled = true,
  notification_weekly_recap_enabled = true,
  notification_project_milestone_enabled = true,
  notification_lead_conversion_enabled = true,
  notification_integration_failure_alert_enabled = true,
  notification_team_invite_accepted_alert_enabled = true,
  notification_delivery_reminder_send_at = '09:00',
  notification_session_reminder_send_at = '09:00',
  notification_daily_summary_send_at = '09:00',
  notification_weekly_recap_send_at = '09:00'
WHERE id IS NOT NULL;

-- Update the ensure_user_settings function to have all notifications enabled by default
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
      notification_overdue_reminder_enabled,
      notification_delivery_reminder_enabled,
      notification_session_reminder_enabled,
      notification_daily_summary_enabled,
      notification_task_nudge_enabled,
      notification_weekly_recap_enabled,
      notification_project_milestone_enabled,
      notification_lead_conversion_enabled,
      notification_integration_failure_alert_enabled,
      notification_team_invite_accepted_alert_enabled,
      notification_delivery_reminder_send_at,
      notification_session_reminder_send_at,
      notification_daily_summary_send_at,
      notification_weekly_recap_send_at
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
      true,
      true,
      true,
      true,
      true,
      '09:00',
      '09:00',
      '09:00',
      '09:00'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$function$;

-- Update organization settings to have all notifications enabled by default
UPDATE public.organization_settings 
SET 
  notification_overdue_reminder_enabled = true,
  notification_delivery_reminder_enabled = true,
  notification_session_reminder_enabled = true,
  notification_daily_summary_enabled = true,
  notification_task_nudge_enabled = true,
  notification_weekly_recap_enabled = true,
  notification_project_milestone_enabled = true,
  notification_lead_conversion_enabled = true,
  notification_integration_failure_alert_enabled = true,
  notification_team_invite_accepted_alert_enabled = true,
  notification_delivery_reminder_send_at = '09:00',
  notification_session_reminder_send_at = '09:00',
  notification_daily_summary_send_at = '09:00',
  notification_weekly_recap_send_at = '09:00'
WHERE id IS NOT NULL;

-- Update the ensure_organization_settings function to have all notifications enabled by default
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
      notification_overdue_reminder_enabled,
      notification_delivery_reminder_enabled,
      notification_session_reminder_enabled,
      notification_daily_summary_enabled,
      notification_task_nudge_enabled,
      notification_integration_failure_alert_enabled,
      notification_team_invite_accepted_alert_enabled,
      notification_weekly_recap_enabled,
      notification_project_milestone_enabled,
      notification_lead_conversion_enabled,
      notification_delivery_reminder_send_at,
      notification_session_reminder_send_at,
      notification_daily_summary_send_at,
      notification_weekly_recap_send_at
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
      true,
      true,
      true,
      true,
      true,
      '09:00',
      '09:00',
      '09:00',
      '09:00'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$function$;