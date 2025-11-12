-- Fix ambiguous slug references inside ensure_default_project_types_for_org.

CREATE OR REPLACE FUNCTION public.ensure_default_project_types_for_org(
  user_uuid uuid,
  org_id uuid,
  preferred_slugs text[] DEFAULT NULL,
  locale text DEFAULT NULL,
  force_replace boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  type_count integer;
  ordered_slugs text[] := ARRAY[]::text[];
  slug_value text;
  template_name text;
  final_locale text := COALESCE(locale, public.get_org_locale(org_id), 'tr');
  sort_index integer := 1;
BEGIN
  IF force_replace THEN
    DELETE FROM public.project_types
    WHERE organization_id = org_id;
  END IF;

  SELECT COUNT(*) INTO type_count
  FROM public.project_types
  WHERE organization_id = org_id;

  IF type_count > 0 THEN
    RETURN;
  END IF;

  IF preferred_slugs IS NOT NULL THEN
    FOREACH slug_value IN ARRAY preferred_slugs LOOP
      IF slug_value IS NOT NULL AND NOT (slug_value = ANY(ordered_slugs)) THEN
        ordered_slugs := ordered_slugs || slug_value;
      END IF;
    END LOOP;
  END IF;

  FOR slug_value IN
    SELECT tpl.slug
    FROM public.default_project_type_templates AS tpl
    WHERE tpl.locale = final_locale
    ORDER BY tpl.sort_order
  LOOP
    IF NOT (slug_value = ANY(ordered_slugs)) THEN
      ordered_slugs := ordered_slugs || slug_value;
    END IF;
  END LOOP;

  FOR slug_value IN
    SELECT tpl.slug
    FROM public.default_project_type_templates AS tpl
    WHERE tpl.locale = 'en'
    ORDER BY tpl.sort_order
  LOOP
    IF NOT (slug_value = ANY(ordered_slugs)) THEN
      ordered_slugs := ordered_slugs || slug_value;
    END IF;
  END LOOP;

  IF array_length(ordered_slugs, 1) IS NULL THEN
    ordered_slugs := ARRAY['wedding','family','event'];
  END IF;

  FOREACH slug_value IN ARRAY ordered_slugs LOOP
    SELECT tpl.name INTO template_name
    FROM public.default_project_type_templates AS tpl
    WHERE tpl.locale = final_locale AND tpl.slug = slug_value
    LIMIT 1;

    IF template_name IS NULL THEN
      SELECT tpl.name INTO template_name
      FROM public.default_project_type_templates AS tpl
      WHERE tpl.locale = 'en' AND tpl.slug = slug_value
      LIMIT 1;
    END IF;

    IF template_name IS NULL THEN
      template_name := initcap(slug_value);
    END IF;

    INSERT INTO public.project_types (
      user_id,
      organization_id,
      template_slug,
      name,
      is_default,
      sort_order
    )
    VALUES (
      user_uuid,
      org_id,
      slug_value,
      template_name,
      sort_index = 1,
      sort_index
    );

    sort_index := sort_index + 1;
  END LOOP;
END;
$function$;
