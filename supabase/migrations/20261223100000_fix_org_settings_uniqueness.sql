-- Prevent duplicate organization settings rows and make ensure_organization_settings atomic.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.organization_settings
)
DELETE FROM public.organization_settings os
USING ranked r
WHERE os.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_settings_organization_id_key'
      AND conrelid = 'public.organization_settings'::regclass
  ) THEN
    ALTER TABLE public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_key UNIQUE (organization_id);
  END IF;
END;
$$;

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
      'legalEntityType', 'freelance',
      'companyName', null,
      'taxOffice', null,
      'taxNumber', null,
      'billingAddress', null,
      'defaultVatRate', 0,
      'defaultVatMode', 'exclusive',
      'pricesIncludeVat', false,
      'vatExempt', true
    ),
    NULL,
    '{}'::text[],
    '{}'::text[],
    false
  )
  ON CONFLICT (organization_id) DO UPDATE
  SET preferred_locale = CASE
    WHEN public.organization_settings.preferred_locale IS NULL
      OR public.organization_settings.preferred_locale = ''
    THEN EXCLUDED.preferred_locale
    ELSE public.organization_settings.preferred_locale
  END
  RETURNING id INTO settings_id;

  RETURN settings_id;
END;
$$;
