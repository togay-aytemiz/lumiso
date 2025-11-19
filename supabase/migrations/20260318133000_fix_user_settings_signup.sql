-- Refresh ensure_user_settings so it matches the current user_settings schema
-- (notification_new_assignment_enabled was dropped in 20250913192637).

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
      true,
      '12:30'
    )
    RETURNING id INTO settings_id;
  END IF;

  RETURN settings_id;
END;
$function$;
