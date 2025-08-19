-- Fix the ensure_organization_settings function to prevent duplicate creation
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
      notification_delivery_reminder_send_at,
      notification_session_reminder_send_at,
      notification_daily_summary_send_at
    ) VALUES (
      org_id,
      'DD/MM/YYYY',
      '12-hour',
      '',
      '#1EB29F',
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      '09:00',
      '09:00',
      '07:00'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$$;

-- Clean up duplicate organization settings (keep the first one for each organization)
DELETE FROM public.organization_settings 
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id) id
  FROM public.organization_settings
  ORDER BY organization_id, created_at ASC
);