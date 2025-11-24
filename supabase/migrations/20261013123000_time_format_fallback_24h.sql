-- Ensure org settings default to 24-hour when locale is TR or when no explicit preference is provided.
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(
  org_id uuid,
  detected_timezone text DEFAULT NULL,
  detected_time_format text DEFAULT NULL,
  detected_locale text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  settings_id uuid;
  final_locale text := COALESCE(NULLIF(detected_locale, ''), 'tr');
  final_time_format text := CASE
    WHEN final_locale LIKE 'tr%' THEN '24-hour'
    ELSE COALESCE(NULLIF(detected_time_format, ''), '24-hour')
  END;
BEGIN
  SELECT id INTO settings_id
  FROM public.organization_settings
  WHERE organization_id = org_id;

  IF settings_id IS NULL THEN
    INSERT INTO public.organization_settings (
      organization_id,
      date_format,
      time_format,
      timezone,
      preferred_locale,
      photography_business_name,
      primary_brand_color,
      notification_global_enabled,
      notification_daily_summary_enabled,
      notification_project_milestone_enabled,
      show_quick_status_buttons,
      tax_profile,
      profile_intake_completed_at,
      preferred_project_types,
      service_focus,
      seed_sample_data_onboarding
    )
    VALUES (
      org_id,
      'DD/MM/YYYY',
      final_time_format,
      COALESCE(NULLIF(detected_timezone, ''), 'Europe/Istanbul'),
      final_locale,
      '',
      '#1EB29F',
      true,
      true,
      true,
      true,
      jsonb_build_object(
        'legalEntityType', 'individual',
        'companyName', null,
        'taxOffice', null,
        'taxNumber', null,
        'billingAddress', null,
        'defaultVatRate', 20,
        'defaultVatMode', 'inclusive',
        'pricesIncludeVat', true
      ),
      NULL,
      '{}'::text[],
      '{}'::text[],
      false
    )
    RETURNING id INTO settings_id;
  ELSE
    UPDATE public.organization_settings
    SET preferred_locale = final_locale
    WHERE id = settings_id
      AND (preferred_locale IS NULL OR preferred_locale = '');
  END IF;

  RETURN settings_id;
END;
$$;
