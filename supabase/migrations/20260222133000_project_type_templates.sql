-- Localized templates for project types + slug tracking

ALTER TABLE public.project_types
  ADD COLUMN IF NOT EXISTS template_slug text;

CREATE TABLE IF NOT EXISTS public.default_project_type_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

INSERT INTO public.default_project_type_templates
  (locale, slug, name, description, sort_order)
VALUES
  ('en','wedding','Wedding','Full wedding coverage.',1),
  ('en','family','Family','Family portraits.',2),
  ('en','children','Children','Milestones for kids.',3),
  ('en','maternity','Maternity','Celebrating motherhood.',4),
  ('en','birth','Birth','Birth-story coverage.',5),
  ('en','newborn','Newborn','Lifestyle newborn sessions.',6),
  ('en','headshots','Headshots','Professional portraits.',7),
  ('en','senior','Senior','Graduation sessions.',8),
  ('en','commercial','Commercial','Brand/product shoots.',9),
  ('en','event','Event','Corporate & social events.',10),
  ('en','pet','Pet','Pets and their humans.',11),
  ('en','real_estate','Real Estate','Property listings.',12),
  ('tr','wedding','Düğün','Düğün hikayesi çekimleri.',1),
  ('tr','family','Aile','Aile portreleri.',2),
  ('tr','children','Çocuk','Çocuk dönüm noktaları.',3),
  ('tr','maternity','Hamilelik','Anne adaylarına özel.',4),
  ('tr','birth','Doğum','Doğum hikaye çekimi.',5),
  ('tr','newborn','Yenidoğan','Yaşam tarzı yenidoğan.',6),
  ('tr','headshots','Portre','Profesyonel portreler.',7),
  ('tr','senior','Mezuniyet','Mezuniyet çekimleri.',8),
  ('tr','commercial','Ticari','Marka ve ürün çekimleri.',9),
  ('tr','event','Etkinlik','Kurumsal ve sosyal etkinlikler.',10),
  ('tr','pet','Evcil Hayvan','Patili dostlarla çekimler.',11),
  ('tr','real_estate','Gayrimenkul','Konut & ticari portföyler.',12)
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

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
  slug text;
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
    FOREACH slug IN ARRAY preferred_slugs LOOP
      IF slug IS NOT NULL AND NOT (slug = ANY(ordered_slugs)) THEN
        ordered_slugs := ordered_slugs || slug;
      END IF;
    END LOOP;
  END IF;

  FOR slug IN
    SELECT slug
    FROM public.default_project_type_templates
    WHERE locale = final_locale
    ORDER BY sort_order
  LOOP
    IF NOT (slug = ANY(ordered_slugs)) THEN
      ordered_slugs := ordered_slugs || slug;
    END IF;
  END LOOP;

  FOR slug IN
    SELECT slug
    FROM public.default_project_type_templates
    WHERE locale = 'en'
    ORDER BY sort_order
  LOOP
    IF NOT (slug = ANY(ordered_slugs)) THEN
      ordered_slugs := ordered_slugs || slug;
    END IF;
  END LOOP;

  IF array_length(ordered_slugs, 1) IS NULL THEN
    ordered_slugs := ARRAY['wedding','family','event'];
  END IF;

  FOREACH slug IN ARRAY ordered_slugs LOOP
    SELECT name INTO template_name
    FROM public.default_project_type_templates
    WHERE locale = final_locale AND slug = slug
    LIMIT 1;

    IF template_name IS NULL THEN
      SELECT name INTO template_name
      FROM public.default_project_type_templates
      WHERE locale = 'en' AND slug = slug
      LIMIT 1;
    END IF;

    IF template_name IS NULL THEN
      template_name := initcap(slug);
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
      slug,
      template_name,
      sort_index = 1,
      sort_index
    );

    sort_index := sort_index + 1;
  END LOOP;
END;
$function$;
