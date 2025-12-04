-- Prefix seeded services with sample tags so default catalog items match lead/project sample labeling.

CREATE OR REPLACE FUNCTION public.ensure_default_services_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  final_locale text := public.normalize_locale_code(public.get_org_locale(org_id), 'tr');
  tr_sample_prefix CONSTANT text := '[Örnek] ';
  en_sample_prefix CONSTANT text := '[Sample Data] ';
  sample_prefix text;
BEGIN
  sample_prefix := CASE
    WHEN final_locale LIKE 'tr%' THEN tr_sample_prefix
    ELSE en_sample_prefix
  END;

  WITH prioritized AS (
    SELECT *, 1 AS priority
    FROM public.default_service_templates
    WHERE locale = final_locale
    UNION ALL
    SELECT *, 2
    FROM public.default_service_templates
    WHERE locale = 'en'
  ),
  chosen AS (
    SELECT DISTINCT ON (slug) *
    FROM prioritized
    ORDER BY slug, priority
  ),
  missing AS (
    SELECT c.*
    FROM chosen c
    LEFT JOIN public.services s
      ON s.organization_id = org_id
     AND s.template_slug = c.slug
    WHERE s.id IS NULL
  )
  INSERT INTO public.services (
    user_id,
    organization_id,
    template_slug,
    name,
    description,
    category,
    service_type,
    cost_price,
    selling_price,
    price,
    extra,
    is_people_based,
    price_includes_vat,
    vat_rate,
    default_unit,
    is_sample
  )
  SELECT
    user_uuid,
    org_id,
    slug,
    CASE
      WHEN name ILIKE tr_sample_prefix || '%'
        OR name ILIKE en_sample_prefix || '%'
      THEN name
      ELSE sample_prefix || name
    END,
    description,
    category,
    service_type,
    cost_price,
    price,
    price,
    extra,
    is_people_based,
    true,
    0,
    default_unit,
    true
  FROM missing
  ORDER BY sort_order;
END;
$function$;

-- Backfill existing sample services so they carry the sample prefix in line with seeded data.
DO $$
DECLARE
  tr_sample_prefix CONSTANT text := '[Örnek] ';
  en_sample_prefix CONSTANT text := '[Sample Data] ';
BEGIN
  UPDATE public.services AS s
  SET name = CASE
    WHEN COALESCE(
      (SELECT public.normalize_locale_code(os.preferred_locale, 'tr')
       FROM public.organization_settings os
       WHERE os.organization_id = s.organization_id
       LIMIT 1),
      'tr'
    ) LIKE 'tr%' THEN tr_sample_prefix || s.name
    ELSE en_sample_prefix || s.name
  END
  WHERE s.is_sample = true
    AND NOT (
      s.name ILIKE tr_sample_prefix || '%'
      OR s.name ILIKE en_sample_prefix || '%'
    );
END $$;
