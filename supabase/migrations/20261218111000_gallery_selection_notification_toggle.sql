-- Add per-user toggle for gallery selection submitted emails (default enabled).

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notification_gallery_selection_enabled boolean DEFAULT true;

UPDATE public.user_settings
SET notification_gallery_selection_enabled = true
WHERE notification_gallery_selection_enabled IS NULL;

-- Refresh ensure_user_settings to include the new column (so new users always
-- start with this notification enabled).
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
      notification_gallery_selection_enabled,
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
      true,
      '09:00'
    )
    RETURNING id INTO settings_id;
  END IF;

  RETURN settings_id;
END;
$function$;

