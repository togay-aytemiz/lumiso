-- Backfill session types for existing organizations using package durations

CREATE OR REPLACE FUNCTION public.parse_session_duration_minutes(input text)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  cleaned text;
  numeric_part text;
  hours_value numeric;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := lower(trim(input));

  IF cleaned = '' THEN
    RETURN NULL;
  END IF;

  -- Map known option keys first (from package duration selector)
  CASE cleaned
    WHEN '30m' THEN RETURN 30;
    WHEN '1h' THEN RETURN 60;
    WHEN '2h' THEN RETURN 120;
    WHEN '3h' THEN RETURN 180;
    WHEN 'half_day' THEN RETURN 240;
    WHEN 'half day' THEN RETURN 240;
    WHEN 'half-day' THEN RETURN 240;
    WHEN 'full_day' THEN RETURN 480;
    WHEN 'full day' THEN RETURN 480;
    WHEN 'full-day' THEN RETURN 480;
    WHEN 'custom' THEN RETURN NULL;
    WHEN 'multi-session' THEN RETURN 90;
    ELSE NULL;
  END CASE;

  -- Normalize textual representations like "2 hours", "6 hour", "90 minutes"
  IF cleaned ~ '^\d+(\.\d+)?\s*(h|hour|hours)$' THEN
    numeric_part := (regexp_match(cleaned, '^([0-9]+(?:\.[0-9]+)?)'))[1];
    hours_value := numeric_part::numeric;
    RETURN round(hours_value * 60);
  ELSIF cleaned ~ '^\d+(\.\d+)?\s*(m|min|mins|minute|minutes)$' THEN
    numeric_part := (regexp_match(cleaned, '^([0-9]+(?:\.[0-9]+)?)'))[1];
    RETURN round(numeric_part::numeric);
  ELSIF cleaned ~ '^\d+\s*-\s*\d+\s*(h|hour|hours)$' THEN
    -- Handle ranges like "2-3 hours" by averaging
    RETURN round((
      (regexp_match(cleaned, '^([0-9]+)'))[1]::numeric +
      (regexp_match(cleaned, '([0-9]+)\s*(h|hour|hours)$'))[1]::numeric
    ) / 2 * 60);
  END IF;

  RETURN NULL;
END;
$function$;

-- Ensure latest version of default seeding function in case prior migration already ran
CREATE OR REPLACE FUNCTION public.ensure_default_session_types_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  type_count integer;
  primary_type_id uuid;
  settings_default uuid;
BEGIN
  -- Ensure organization settings exist (needed for default assignment)
  PERFORM public.ensure_organization_settings(org_id, NULL);

  SELECT COUNT(*) INTO type_count
  FROM public.session_types
  WHERE organization_id = org_id;

  IF type_count = 0 THEN
    INSERT INTO public.session_types (
      organization_id,
      user_id,
      name,
      description,
      category,
      duration_minutes,
      is_active,
      sort_order
    ) VALUES (
      org_id,
      user_uuid,
      'Signature Session',
      'Standard portrait session covering prep, shoot, and wrap-up.',
      'Photography',
      90,
      true,
      1
    )
    RETURNING id INTO primary_type_id;

    INSERT INTO public.session_types (
      organization_id,
      user_id,
      name,
      description,
      category,
      duration_minutes,
      is_active,
      sort_order
    ) VALUES (
      org_id,
      user_uuid,
      'Mini Session',
      'Short-form session ideal for seasonal promos or quick refreshers.',
      'Photography',
      30,
      true,
      2
    );
  END IF;

  SELECT default_session_type_id
  INTO settings_default
  FROM public.organization_settings
  WHERE organization_id = org_id;

  IF settings_default IS NULL THEN
    IF primary_type_id IS NULL THEN
      SELECT id
      INTO primary_type_id
      FROM public.session_types
      WHERE organization_id = org_id
        AND is_active = true
      ORDER BY sort_order, created_at
      LIMIT 1;
    END IF;

    IF primary_type_id IS NOT NULL THEN
      UPDATE public.organization_settings
      SET default_session_type_id = primary_type_id,
          updated_at = now()
      WHERE organization_id = org_id;
    END IF;
  END IF;
END;
$function$;

WITH candidate_packages AS (
  SELECT
    p.id,
    p.organization_id,
    p.user_id,
    p.name AS package_name,
    p.duration,
    public.parse_session_duration_minutes(p.duration) AS duration_minutes,
    ROW_NUMBER() OVER (PARTITION BY p.organization_id ORDER BY p.created_at, p.id) AS package_rank
  FROM public.packages p
  WHERE p.organization_id IS NOT NULL
    AND COALESCE(trim(p.duration), '') <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.session_types st
      WHERE st.organization_id = p.organization_id
    )
)
INSERT INTO public.session_types (
  organization_id,
  user_id,
  name,
  description,
  category,
  duration_minutes,
  is_active,
  sort_order
)
SELECT
  cp.organization_id,
  cp.user_id,
  'Session - ' ||
    COALESCE(NULLIF(trim(cp.package_name), ''), 'Package') ||
    ' (' ||
    CASE
      WHEN cp.duration_minutes >= 60 AND cp.duration_minutes % 60 = 0 THEN
        (cp.duration_minutes / 60)::text || 'h'
      ELSE
        cp.duration_minutes::text || 'm'
    END || ')',
  'Auto-generated from package "' || cp.package_name || '" during session type migration.',
  'Packages',
  cp.duration_minutes,
  true,
  cp.package_rank + 10
FROM candidate_packages cp
WHERE cp.duration_minutes IS NOT NULL
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  org_record record;
BEGIN
  FOR org_record IN
    SELECT id AS organization_id, owner_id
    FROM public.organizations
  LOOP
    PERFORM public.ensure_default_session_types_for_org(org_record.owner_id, org_record.organization_id);
  END LOOP;
END;
$$;
