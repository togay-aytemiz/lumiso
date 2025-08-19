-- Add organization-wide notification settings to organization_settings table
ALTER TABLE public.organization_settings 
ADD COLUMN IF NOT EXISTS notification_overdue_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_delivery_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_session_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_daily_summary_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_task_nudge_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_integration_failure_alert_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_team_invite_accepted_alert_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_delivery_reminder_send_at text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS notification_session_reminder_send_at text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS notification_daily_summary_send_at text DEFAULT '07:00';

-- Create function to ensure organization settings exist
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  settings_id uuid;
BEGIN
  -- Try to get existing settings
  SELECT id INTO settings_id
  FROM public.organization_settings
  WHERE organization_id = org_id;
  
  -- Create default settings if they don't exist
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