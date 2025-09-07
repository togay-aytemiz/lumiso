-- Remove time_format from user_settings (should come from organization_settings)
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS time_format;

-- Update the ensure_user_settings function to not include time_format
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
      true,
      true,
      true,
      true,
      '12:30'
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$function$;