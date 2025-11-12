-- Localized template tables for services, packages, and session types

-- Track template slugs on seeded tables for easier mapping
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS template_slug text;

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS template_slug text;

ALTER TABLE public.session_types
  ADD COLUMN IF NOT EXISTS template_slug text;

CREATE TABLE IF NOT EXISTS public.default_service_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  description text,
  category text,
  service_type text NOT NULL CHECK (service_type IN ('coverage', 'deliverable')),
  cost_price numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  extra boolean NOT NULL DEFAULT false,
  is_people_based boolean NOT NULL DEFAULT false,
  default_unit text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.default_session_type_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 60,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.default_package_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  applicable_type_labels text[] NOT NULL DEFAULT '{}',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

-- Seed service templates (crew + deliverables)
INSERT INTO public.default_service_templates
  (locale, slug, name, description, category, service_type, cost_price, price, extra, default_unit, sort_order)
VALUES
  ('en', 'lead_photographer', 'Lead Photographer', 'Full-day coverage by senior photographer.', 'Crew', 'coverage', 2000, 6000, false, 'day', 1),
  ('en', 'assistant_photographer', 'Assistant Photographer', 'Second shooter for key moments.', 'Crew', 'coverage', 1200, 3500, false, 'day', 2),
  ('en', 'signature_album', 'Signature Album', '30x30 leather album with 30 spreads.', 'Deliverables', 'deliverable', 1500, 3000, false, null, 3),
  ('en', 'drone_addon', 'Drone Coverage', 'Aerial footage during the session.', 'Deliverables', 'coverage', 800, 1800, true, 'hour', 4),
  ('tr', 'lead_photographer', 'Baş Fotoğrafçı', 'Kıdemli fotoğrafçı ile tam gün çekim.', 'Ekip', 'coverage', 2000, 6000, false, 'gün', 1),
  ('tr', 'assistant_photographer', 'Asistan Fotoğrafçı', 'İkinci fotoğrafçı desteği.', 'Ekip', 'coverage', 1200, 3500, false, 'gün', 2),
  ('tr', 'signature_album', 'Prestij Albüm', '30x30 deri kapaklı 30 yapraklı albüm.', 'Teslimatlar', 'deliverable', 1500, 3000, false, null, 3),
  ('tr', 'drone_addon', 'Drone Çekimi', 'Seans sırasında hava görüntüleri.', 'Teslimatlar', 'coverage', 800, 1800, true, 'saat', 4)
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    service_type = EXCLUDED.service_type,
    cost_price = EXCLUDED.cost_price,
    price = EXCLUDED.price,
    extra = EXCLUDED.extra,
    default_unit = EXCLUDED.default_unit,
    sort_order = EXCLUDED.sort_order;

-- Seed session type templates
INSERT INTO public.default_session_type_templates
  (locale, slug, name, description, duration_minutes, category, sort_order)
VALUES
  ('en', 'signature_session', 'Signature Session', '90-minute session covering prep, shoot, and wrap-up.', 90, 'Photography', 1),
  ('en', 'mini_session', 'Mini Session', '30-minute bite-size experience ideal for promos.', 30, 'Photography', 2),
  ('tr', 'signature_session', 'Standart Çekim', 'Hazırlık ve çekimi içeren 90 dakikalık seans.', 90, 'Fotoğrafçılık', 1),
  ('tr', 'mini_session', 'Mini Çekim', 'Kampanyalar için 30 dakikalık hızlı deneyim.', 30, 'Fotoğrafçılık', 2)
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    duration_minutes = EXCLUDED.duration_minutes,
    category = EXCLUDED.category,
    sort_order = EXCLUDED.sort_order;

-- Seed package templates (line_items reference service slugs)
INSERT INTO public.default_package_templates
  (locale, slug, name, description, price, applicable_type_labels, line_items, sort_order)
VALUES
  ('en', 'wedding_story', 'Wedding Story', 'Full-day wedding coverage with album + drone add-on.', 15000,
    ARRAY['Wedding'],
    jsonb_build_array(
      jsonb_build_object('serviceSlug', 'lead_photographer', 'role', 'base', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'assistant_photographer', 'role', 'base', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'signature_album', 'role', 'addon', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'drone_addon', 'role', 'addon', 'quantity', 1)
    ),
    1
  ),
  ('en', 'mini_lifestyle', 'Mini Lifestyle', 'Compact session perfect for families or portraits.', 4500,
    ARRAY['Family', 'Portrait'],
    jsonb_build_array(
      jsonb_build_object('serviceSlug', 'lead_photographer', 'role', 'base', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'signature_album', 'role', 'addon', 'quantity', 1)
    ),
    2
  ),
  ('tr', 'wedding_story', 'Düğün Hikayesi', 'Albüm ve drone ile tam gün düğün paketi.', 15000,
    ARRAY['Düğün'],
    jsonb_build_array(
      jsonb_build_object('serviceSlug', 'lead_photographer', 'role', 'base', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'assistant_photographer', 'role', 'base', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'signature_album', 'role', 'addon', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'drone_addon', 'role', 'addon', 'quantity', 1)
    ),
    1
  ),
  ('tr', 'mini_lifestyle', 'Mini Lifestyle', 'Aile veya portre çekimleri için kısa seans.', 4500,
    ARRAY['Aile', 'Portre'],
    jsonb_build_array(
      jsonb_build_object('serviceSlug', 'lead_photographer', 'role', 'base', 'quantity', 1),
      jsonb_build_object('serviceSlug', 'signature_album', 'role', 'addon', 'quantity', 1)
    ),
    2
  )
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    applicable_type_labels = EXCLUDED.applicable_type_labels,
    line_items = EXCLUDED.line_items,
    sort_order = EXCLUDED.sort_order;

-- Helper to resolve preferred locale
CREATE OR REPLACE FUNCTION public.get_org_locale(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(preferred_locale, 'tr')
  FROM public.organization_settings
  WHERE organization_id = org_id
  LIMIT 1;
$function$;

-- Rebuild ensure_default_services_for_org to honor locale templates
CREATE OR REPLACE FUNCTION public.ensure_default_services_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
BEGIN
  SELECT COUNT(*) INTO service_count
  FROM public.services
  WHERE organization_id = org_id;

  IF service_count > 0 THEN
    RETURN;
  END IF;

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
    name,
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
  FROM chosen
  ORDER BY sort_order;
END;
$function$;

-- Rebuild ensure_default_session_types_for_org using templates
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
    ),
    inserted AS (
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
      ORDER BY sort_order
      RETURNING id, template_slug, sort_order
    )
    SELECT 1;
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

-- Rebuild package seeding using templates and service slug mapping
CREATE OR REPLACE FUNCTION public.ensure_default_packages_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  package_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
  chosen_record RECORD;
  prioritized RECORD;
  add_on_ids text[];
  line_items jsonb;
  template_row RECORD;
  service_id uuid;
  role text;
  qty integer;
  service_slug text;
BEGIN
  SELECT COUNT(*) INTO package_count
  FROM public.packages
  WHERE organization_id = org_id;

  IF package_count > 0 THEN
    RETURN;
  END IF;

  PERFORM public.ensure_default_services_for_org(user_uuid, org_id);

  FOR template_row IN
    WITH prioritized AS (
      SELECT *, 1 AS priority
      FROM public.default_package_templates
      WHERE locale = final_locale
      UNION ALL
      SELECT *, 2
      FROM public.default_package_templates
      WHERE locale = 'en'
    ),
    chosen AS (
      SELECT DISTINCT ON (slug) *
      FROM prioritized
      ORDER BY slug, priority
    )
    SELECT *
    FROM chosen
    ORDER BY sort_order
  LOOP
    add_on_ids := ARRAY[]::text[];
    line_items := '[]'::jsonb;

    FOR chosen_record IN
      SELECT
        item->>'serviceSlug' AS service_slug,
        COALESCE(NULLIF(item->>'role', ''), 'addon') AS item_role,
        COALESCE((item->>'quantity')::int, 1) AS item_qty
      FROM jsonb_array_elements(template_row.line_items) AS item
    LOOP
      service_slug := chosen_record.service_slug;
      role := chosen_record.item_role;
      qty := chosen_record.item_qty;

      SELECT id INTO service_id
      FROM public.services
      WHERE organization_id = org_id
        AND template_slug = service_slug
      LIMIT 1;

      IF service_id IS NULL THEN
        CONTINUE;
      END IF;

      line_items := line_items || jsonb_build_object(
        'serviceId', service_id::text,
        'role', role,
        'quantity', qty
      );

      IF role = 'addon' THEN
        add_on_ids := array_append(add_on_ids, service_id::text);
      END IF;
    END LOOP;

    INSERT INTO public.packages (
      user_id,
      organization_id,
      template_slug,
      name,
      description,
      price,
      applicable_types,
      default_add_ons,
      line_items,
      is_active
    )
    VALUES (
      user_uuid,
      org_id,
      template_row.slug,
      template_row.name,
      template_row.description,
      template_row.price,
      template_row.applicable_type_labels,
      add_on_ids,
      line_items,
      true
    );
  END LOOP;
END;
$function$;
