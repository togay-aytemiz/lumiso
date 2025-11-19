-- Rebuild ensure_default_session_types_for_org without the trailing SELECT
-- so the CTE runs as a pure INSERT statement.

CREATE OR REPLACE FUNCTION public.ensure_default_session_types_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  type_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
  settings_default uuid;
BEGIN
  SELECT COUNT(*) INTO type_count
  FROM public.session_types
  WHERE organization_id = org_id;

  IF type_count = 0 THEN
    WITH prioritized AS (
      SELECT *, 1 AS priority
      FROM public.default_session_type_templates
      WHERE locale = final_locale
      UNION ALL
      SELECT *, 2
      FROM public.default_session_type_templates
      WHERE locale = 'en'
    ),
    chosen AS (
      SELECT DISTINCT ON (slug) *
      FROM prioritized
      ORDER BY slug, priority
    )
    INSERT INTO public.session_types (
      organization_id,
      user_id,
      template_slug,
      name,
      description,
      category,
      duration_minutes,
      is_active,
      sort_order
    )
    SELECT
      org_id,
      user_uuid,
      slug,
      name,
      description,
      category,
      duration_minutes,
      true,
      sort_order
    FROM chosen
    ORDER BY sort_order;
  END IF;

  SELECT default_session_type_id
  INTO settings_default
  FROM public.organization_settings
  WHERE organization_id = org_id;

  IF settings_default IS NULL THEN
    UPDATE public.organization_settings
    SET default_session_type_id = (
      SELECT id
      FROM public.session_types
      WHERE organization_id = org_id
      ORDER BY sort_order, created_at
      LIMIT 1
    )
    WHERE organization_id = org_id;
  END IF;
END;
$function$;
