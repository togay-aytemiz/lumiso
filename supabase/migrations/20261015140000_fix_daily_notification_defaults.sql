-- Align daily summary defaults with the UI expectation and stop creating new
-- users with a 12:30 delivery time.

-- Ensure new rows default to 09:00
ALTER TABLE public.user_settings
  ALTER COLUMN notification_scheduled_time SET DEFAULT '09:00';

-- Refresh ensure_user_settings to use the 09:00 default
CREATE OR REPLACE FUNCTION public.ensure_user_settings(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  settings_id uuid;
BEGIN
  SELECT id INTO settings_id
  FROM public.user_settings
  WHERE user_id = user_uuid;

  IF settings_id IS NULL THEN
    INSERT INTO public.user_settings (
      user_id,
      show_quick_status_buttons,
      photography_business_name,
      logo_url,
      primary_brand_color,
      date_format,
      notification_global_enabled,
      notification_daily_summary_enabled,
      notification_project_milestone_enabled,
      notification_scheduled_time
    ) VALUES (
      user_uuid,
      true,
      '',
      null,
      '#1EB29F',
      'DD/MM/YYYY',
      true,
      true,
      false,
      '09:00'
    )
    RETURNING id INTO settings_id;
  END IF;

  RETURN settings_id;
END;
$function$;

-- Backfill untouched rows that still carry the old 12:30 default
UPDATE public.user_settings
SET notification_scheduled_time = '09:00'
WHERE notification_scheduled_time = '12:30'
  AND created_at = updated_at;
