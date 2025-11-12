-- Track whether an org opted into sample data during the intake flow
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS seed_sample_data_onboarding BOOLEAN DEFAULT false;

UPDATE public.organization_settings
SET seed_sample_data_onboarding = COALESCE(seed_sample_data_onboarding, false);

ALTER TABLE public.organization_settings
  ALTER COLUMN seed_sample_data_onboarding SET NOT NULL;

-- Keep helper aligned with the new column
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(
  org_id uuid,
  detected_timezone text DEFAULT NULL,
  detected_time_format text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  settings_id uuid;
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
      COALESCE(NULLIF(detected_time_format, ''), '24-hour'),
      COALESCE(NULLIF(detected_timezone, ''), 'Europe/Istanbul'),
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
  END IF;

  RETURN settings_id;
END;
$$;
