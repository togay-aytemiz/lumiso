CREATE OR REPLACE FUNCTION public.ensure_default_packages_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  package_count integer;
  final_locale text := public.normalize_locale_code(public.get_org_locale(org_id), 'tr');
  add_on_ids text[];
  line_items jsonb;
  template_row RECORD;
  chosen_record RECORD;
  service_id uuid;
  service_name text;
  role text;
  qty integer;
  service_slug text;
  deposit_percent numeric;
  deposit_amount numeric;
  pricing_metadata jsonb;
  applicable_type_ids text[];
  candidate_type_slugs text[];
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

    candidate_type_slugs := ARRAY(
      SELECT slug
      FROM (
        SELECT slug
        FROM public.default_project_type_templates
        WHERE locale = final_locale
          AND name = ANY(template_row.applicable_type_labels)
        UNION
        SELECT slug
        FROM public.default_project_type_templates
        WHERE locale = 'en'
          AND name = ANY(template_row.applicable_type_labels)
      ) resolved
    );

    SELECT array_agg(pt.id::text)
    INTO applicable_type_ids
    FROM public.project_types pt
    WHERE pt.organization_id = org_id
      AND (
        pt.name = ANY(template_row.applicable_type_labels)
        OR (
          candidate_type_slugs IS NOT NULL
          AND array_length(candidate_type_slugs, 1) > 0
          AND pt.template_slug = ANY(candidate_type_slugs)
        )
      );

    IF array_length(applicable_type_ids, 1) IS NULL THEN
      applicable_type_ids := template_row.applicable_type_labels;
    END IF;

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
      service_name := NULL;

      SELECT id, name INTO service_id, service_name
      FROM public.services
      WHERE organization_id = org_id
        AND template_slug = service_slug
      LIMIT 1;

      IF service_id IS NULL THEN
        WITH prioritized_services AS (
          SELECT *, 1 AS priority
          FROM public.default_service_templates
          WHERE locale = final_locale
            AND slug = service_slug
          UNION ALL
          SELECT *, 2
          FROM public.default_service_templates
          WHERE locale = 'en'
            AND slug = service_slug
        ),
        chosen_service AS (
          SELECT *
          FROM prioritized_services
          ORDER BY priority
          LIMIT 1
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
        FROM chosen_service
        RETURNING id, name INTO service_id, service_name;
      END IF;

      IF service_id IS NULL THEN
        CONTINUE;
      END IF;

      IF service_name IS NULL THEN
        service_name := initcap(replace(COALESCE(service_slug, ''), '_', ' '));
      END IF;

      line_items := line_items || jsonb_build_array(
        jsonb_build_object(
          'serviceId', service_id::text,
          'role', role,
          'quantity', qty,
          'type', 'existing',
          'source', 'catalog',
          'name', service_name
        )
      );

      IF role = 'addon' THEN
        add_on_ids := array_append(add_on_ids, service_id::text);
      END IF;
    END LOOP;

    deposit_percent := CASE template_row.slug
      WHEN 'mini_lifestyle' THEN 30
      WHEN 'wedding_story' THEN 40
      ELSE 25
    END;
    deposit_amount := round(COALESCE(template_row.price, 0) * deposit_percent / 100.0, 2);

    pricing_metadata := jsonb_build_object(
      'enableDeposit', deposit_percent > 0,
      'depositMode', 'percent_base',
      'depositValue', deposit_percent,
      'depositTarget', 'base',
      'depositAmount', deposit_amount,
      'packageVatRate', NULL,
      'packageVatMode', 'exclusive',
      'packageVatOverrideEnabled', false,
      'basePriceInput', template_row.price
    );

    INSERT INTO public.packages (
      user_id,
      organization_id,
      template_slug,
      name,
      description,
      price,
      client_total,
      applicable_types,
      default_add_ons,
      line_items,
      is_active,
      delivery_estimate_type,
      delivery_photo_count_min,
      delivery_photo_count_max,
      delivery_lead_time_value,
      delivery_lead_time_unit,
      delivery_methods,
      include_addons_in_price,
      pricing_metadata
    )
    VALUES (
      user_uuid,
      org_id,
      template_row.slug,
      template_row.name,
      template_row.description,
      template_row.price,
      template_row.price,
      applicable_type_ids,
      add_on_ids,
      line_items,
      true,
      'single',
      NULL,
      NULL,
      NULL,
      NULL,
      '[]'::jsonb,
      true,
      pricing_metadata
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_default_session_types_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  type_count integer;
  final_locale text := public.normalize_locale_code(public.get_org_locale(org_id), 'tr');
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
