-- Align onboarding defaults for notifications, project stages, session stages, and billing locale polish

ALTER TABLE public.user_settings
  ALTER COLUMN notification_project_milestone_enabled SET DEFAULT false;

ALTER TABLE public.organization_settings
  ALTER COLUMN notification_project_milestone_enabled SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.normalize_locale_code(raw_locale text, fallback text DEFAULT 'tr')
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(COALESCE(NULLIF(trim(raw_locale), ''), fallback));
  normalized := replace(normalized, '_', '-');
  normalized := split_part(normalized, '-', 1);
  IF normalized IS NULL OR normalized = '' THEN
    normalized := fallback;
  END IF;
  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_settings(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  settings_id uuid;
BEGIN
  SELECT id INTO settings_id
  FROM public.user_settings
  WHERE user_id = user_uuid;

  IF settings_id IS NULL THEN
    INSERT INTO public.user_settings (
      user_id,
      show_quick_status_buttons,
      photography_business_name,
      logo_url,
      primary_brand_color,
      date_format,
      notification_global_enabled,
      notification_daily_summary_enabled,
      notification_project_milestone_enabled,
      notification_scheduled_time
    ) VALUES (
      user_uuid,
      true,
      '',
      null,
      '#1EB29F',
      'DD/MM/YYYY',
      true,
      true,
      false,
      '12:30'
    )
    RETURNING id INTO settings_id;
  END IF;

  RETURN settings_id;
END;
$function$;

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
  final_locale text := public.normalize_locale_code(detected_locale, 'tr');
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
      COALESCE(NULLIF(detected_time_format, ''), '24-hour'),
      COALESCE(NULLIF(detected_timezone, ''), 'Europe/Istanbul'),
      final_locale,
      '',
      '#1EB29F',
      true,
      true,
      false,
      true,
      jsonb_build_object(
        'legalEntityType', 'freelance',
        'companyName', null,
        'taxOffice', null,
        'taxNumber', null,
        'billingAddress', null,
        'defaultVatRate', 0,
        'defaultVatMode', 'exclusive',
        'pricesIncludeVat', false
      ),
      NULL,
      '{}'::text[],
      '{}'::text[],
      false
    )
    RETURNING id INTO settings_id;
  ELSE
    UPDATE public.organization_settings
    SET preferred_locale = CASE
        WHEN preferred_locale IS NULL OR preferred_locale = '' THEN final_locale
        ELSE public.normalize_locale_code(preferred_locale, 'tr')
      END
    WHERE id = settings_id;
  END IF;

  RETURN settings_id;
END;
$$;

UPDATE public.organization_settings
SET preferred_locale = public.normalize_locale_code(preferred_locale, 'tr');

CREATE OR REPLACE FUNCTION public.get_org_locale(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT public.normalize_locale_code(preferred_locale, 'tr')
  FROM public.organization_settings
  WHERE organization_id = org_id
  LIMIT 1;
$function$;

UPDATE public.default_project_status_templates
SET color = '#3B82F6'
WHERE slug = 'contract';

UPDATE public.project_statuses
SET color = '#3B82F6'
WHERE template_slug = 'contract';

DELETE FROM public.default_session_status_templates
WHERE slug = 'scheduled';

DELETE FROM public.session_statuses
WHERE template_slug = 'scheduled';

CREATE OR REPLACE FUNCTION public.normalize_session_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(NEW.status) = 'scheduled' THEN
    NEW.status := 'planned';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_status_normalizer ON public.sessions;

CREATE TRIGGER session_status_normalizer
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.normalize_session_status();

UPDATE public.sessions
SET status = 'planned'
WHERE lower(status) = 'scheduled';

-- Refresh workflow template metadata for localized naming and triggers
UPDATE public.default_workflow_templates
SET
  name = 'Session Scheduled Confirmation',
  description = 'Send a confirmation email immediately when a session is created.',
  trigger_type = 'session_scheduled',
  trigger_conditions = '{}'::jsonb,
  definition = jsonb_build_array(
    jsonb_build_object(
      'step_order', 1,
      'action', 'send_notification',
      'delay_minutes', 0,
      'config', jsonb_build_object(
        'template_slug', 'session_confirmation',
        'channels', ARRAY['email']
      )
    )
  )
WHERE slug = 'session_confirmation' AND locale = 'en';

UPDATE public.default_workflow_templates
SET
  name = 'Seans Planlandı Onayı',
  description = 'Seans planlanır planlanmaz onay e-postası gönderir.',
  trigger_type = 'session_scheduled',
  trigger_conditions = '{}'::jsonb
WHERE slug = 'session_confirmation' AND locale = 'tr';

UPDATE public.default_workflow_templates
SET
  name = 'Session Reminder (3 days)',
  description = 'Send an email reminder three days before the session.',
  trigger_type = 'session_reminder',
  trigger_conditions = jsonb_build_object('reminder_hours', 72),
  definition = jsonb_build_array(
    jsonb_build_object(
      'step_order', 1,
      'action', 'send_notification',
      'delay_minutes', 4320,
      'config', jsonb_build_object(
        'template_slug', 'session_reminder',
        'channels', ARRAY['email']
      )
    )
  )
WHERE slug = 'session_reminder_workflow' AND locale = 'en';

UPDATE public.default_workflow_templates
SET
  name = 'Seans Hatırlatıcısı (3 gün)',
  description = 'Seans tarihinden 3 gün önce e-posta hatırlatıcısı gönderir.',
  trigger_type = 'session_reminder',
  trigger_conditions = jsonb_build_object('reminder_hours', 72),
  definition = jsonb_build_array(
    jsonb_build_object(
      'step_order', 1,
      'action', 'send_notification',
      'delay_minutes', 4320,
      'config', jsonb_build_object(
        'template_slug', 'session_reminder',
        'channels', ARRAY['email']
      )
    )
  )
WHERE slug = 'session_reminder_workflow' AND locale = 'tr';

-- Enrich default message templates with structured session details blocks
UPDATE public.default_message_template_templates
SET placeholders = ARRAY['client_first_name','session_name','session_type','session_date','session_time','session_notes','location'],
    blocks = jsonb_build_array(
  jsonb_build_object(
    'id','text-1',
    'type','text',
    'visible',true,
    'order',0,
    'data',jsonb_build_object(
      'content','Hi {{client_first_name}},',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','text-2',
    'type','text',
    'visible',true,
    'order',1,
    'data',jsonb_build_object(
      'content','We''re excited to meet you on {{session_date}} at {{session_time}} ({{location}}).',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session-details',
    'type','session-details',
    'visible',true,
    'order',2,
    'data',jsonb_build_object(
      'customLabel','Session Details',
      'showName',true,
      'showType',true,
      'showDate',true,
      'showTime',true,
      'showNotes',true,
      'showDuration',false,
      'showStatus',false,
      'showLocation',false,
      'showMeetingLink',false,
      'showProject',false,
      'showPackage',false
    )
  ),
  jsonb_build_object(
    'id','text-3',
    'type','text',
    'visible',true,
    'order',3,
    'data',jsonb_build_object(
      'content','Feel free to reply if you need anything before then!',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE slug = 'session_confirmation' AND locale = 'en';

UPDATE public.default_message_template_templates
SET placeholders = ARRAY['client_first_name','session_name','session_type','session_date','session_time','session_notes','location'],
    blocks = jsonb_build_array(
  jsonb_build_object(
    'id','text-tr-1',
    'type','text',
    'visible',true,
    'order',0,
    'data',jsonb_build_object(
      'content','Merhaba {{client_first_name}},',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','text-tr-2',
    'type','text',
    'visible',true,
    'order',1,
    'data',jsonb_build_object(
      'content','{{session_date}} {{session_time}} saatinde {{location}} lokasyonunda buluşuyoruz.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','session-details-tr',
    'type','session-details',
    'visible',true,
    'order',2,
    'data',jsonb_build_object(
      'customLabel','Seans Detayları',
      'showName',true,
      'showType',true,
      'showDate',true,
      'showTime',true,
      'showNotes',true,
      'showDuration',false,
      'showStatus',false,
      'showLocation',false,
      'showMeetingLink',false,
      'showProject',false,
      'showPackage',false
    )
  ),
  jsonb_build_object(
    'id','text-tr-3',
    'type','text',
    'visible',true,
    'order',3,
    'data',jsonb_build_object(
      'content','Sorularınız olursa bize yazabilirsiniz!',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE slug = 'session_confirmation' AND locale = 'tr';

UPDATE public.default_message_template_templates
SET placeholders = ARRAY['session_name','session_type','session_date','session_time','session_notes'],
    blocks = jsonb_build_array(
  jsonb_build_object(
    'id','reminder-text-1',
    'type','text',
    'visible',true,
    'order',0,
    'data',jsonb_build_object(
      'content','Hi there,',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','reminder-text-2',
    'type','text',
    'visible',true,
    'order',1,
    'data',jsonb_build_object(
      'content','Just a friendly reminder that your session is coming up on {{session_date}} at {{session_time}}.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','reminder-session-details',
    'type','session-details',
    'visible',true,
    'order',2,
    'data',jsonb_build_object(
      'customLabel','Session Details',
      'showName',true,
      'showType',true,
      'showDate',true,
      'showTime',true,
      'showNotes',true,
      'showDuration',false,
      'showStatus',false,
      'showLocation',false,
      'showMeetingLink',false,
      'showProject',false,
      'showPackage',false
    )
  ),
  jsonb_build_object(
    'id','reminder-text-3',
    'type','text',
    'visible',true,
    'order',3,
    'data',jsonb_build_object(
      'content','Let us know if you need anything!',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE slug = 'session_reminder' AND locale = 'en';

UPDATE public.default_message_template_templates
SET placeholders = ARRAY['session_name','session_type','session_date','session_time','session_notes'],
    blocks = jsonb_build_array(
  jsonb_build_object(
    'id','reminder-tr-text-1',
    'type','text',
    'visible',true,
    'order',0,
    'data',jsonb_build_object(
      'content','Merhaba,',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','reminder-tr-text-2',
    'type','text',
    'visible',true,
    'order',1,
    'data',jsonb_build_object(
      'content','Kısa bir hatırlatma: Çekiminiz {{session_date}} {{session_time}} saatinde gerçekleşecek.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  ),
  jsonb_build_object(
    'id','reminder-session-details-tr',
    'type','session-details',
    'visible',true,
    'order',2,
    'data',jsonb_build_object(
      'customLabel','Seans Detayları',
      'showName',true,
      'showType',true,
      'showDate',true,
      'showTime',true,
      'showNotes',true,
      'showDuration',false,
      'showStatus',false,
      'showLocation',false,
      'showMeetingLink',false,
      'showProject',false,
      'showPackage',false
    )
  ),
  jsonb_build_object(
    'id','reminder-tr-text-3',
    'type','text',
    'visible',true,
    'order',3,
    'data',jsonb_build_object(
      'content','Bir değişiklik olursa bize haber verebilirsiniz.',
      'formatting',jsonb_build_object('fontSize','p','alignment','left')
    )
  )
)
WHERE slug = 'session_reminder' AND locale = 'tr';

-- Remove legacy 24h/2h reminder workflows seeded previously
WITH legacy AS (
  SELECT id FROM public.workflows
  WHERE trigger_type = 'session_reminder'
    AND name IN ('24-Hour Session Reminder','2-Hour Session Reminder')
)
DELETE FROM public.scheduled_session_reminders
WHERE workflow_id IN (SELECT id FROM legacy);

WITH legacy AS (
  SELECT id FROM public.workflows
  WHERE trigger_type = 'session_reminder'
    AND name IN ('24-Hour Session Reminder','2-Hour Session Reminder')
)
DELETE FROM public.workflows
WHERE id IN (SELECT id FROM legacy);

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT o.id AS org_id,
           o.owner_id,
           COUNT(w.id) AS total_workflows,
           COUNT(w.id) FILTER (WHERE w.trigger_type = 'session_reminder') AS reminder_count
    FROM public.organizations o
    LEFT JOIN public.workflows w ON w.organization_id = o.id
    GROUP BY o.id, o.owner_id
  LOOP
    IF rec.total_workflows = 0 THEN
      PERFORM public.ensure_default_message_templates(rec.owner_id, rec.org_id);
      PERFORM public.ensure_default_workflows_for_org(rec.owner_id, rec.org_id);
    ELSIF rec.reminder_count = 0 THEN
      PERFORM public.ensure_default_session_reminder_workflows(rec.owner_id, rec.org_id);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_default_services_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  final_locale text := public.normalize_locale_code(public.get_org_locale(org_id), 'tr');
BEGIN
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
  FROM missing
  ORDER BY sort_order;
END;
$function$;

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
  role text;
  qty integer;
  service_slug text;
  deposit_percent numeric;
  deposit_amount numeric;
  pricing_metadata jsonb;
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
        RETURNING id INTO service_id;
      END IF;

      IF service_id IS NULL THEN
        CONTINUE;
      END IF;

      line_items := line_items || jsonb_build_array(
        jsonb_build_object(
          'serviceId', service_id::text,
          'role', role,
          'quantity', qty
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
      template_row.applicable_type_labels,
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

CREATE OR REPLACE FUNCTION public.ensure_default_workflows_for_org(owner_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  existing_count integer;
  final_locale text := public.normalize_locale_code(public.get_org_locale(org_id), 'tr');
  wf RECORD;
  template_slug text;
  workflow_id uuid;
  definition_step jsonb;
  template_id uuid;
  action_config jsonb;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM public.workflows
  WHERE organization_id = org_id;

  IF existing_count > 0 THEN
    RETURN;
  END IF;

  FOR wf IN
    WITH prioritized AS (
      SELECT *, 1 AS priority
      FROM public.default_workflow_templates
      WHERE locale = final_locale
      UNION ALL
      SELECT *, 2
      FROM public.default_workflow_templates
      WHERE locale = 'en'
    ),
    chosen AS (
      SELECT DISTINCT ON (slug) *
      FROM prioritized
      ORDER BY slug, priority
    )
    SELECT * FROM chosen ORDER BY sort_order
  LOOP
    INSERT INTO public.workflows (
      user_id,
      organization_id,
      name,
      description,
      trigger_type,
      trigger_conditions,
      is_active
    )
    VALUES (
      owner_uuid,
      org_id,
      wf.name,
      wf.description,
      wf.trigger_type,
      wf.trigger_conditions,
      true
    ) RETURNING id INTO workflow_id;

    FOR definition_step IN SELECT * FROM jsonb_array_elements(wf.definition)
    LOOP
      template_slug := definition_step->>'template_slug';
      IF template_slug IS NOT NULL THEN
        SELECT id
        INTO template_id
        FROM public.message_templates
        WHERE organization_id = org_id
          AND template_slug = template_slug
        LIMIT 1;
      ELSE
        template_id := NULL;
      END IF;

      action_config := COALESCE(definition_step->'config', '{}'::jsonb);
      IF template_id IS NOT NULL THEN
        action_config := action_config || jsonb_build_object('template_id', template_id);
      END IF;
      IF template_slug IS NOT NULL THEN
        action_config := action_config || jsonb_build_object('template_slug', template_slug);
      END IF;

      INSERT INTO public.workflow_steps (
        workflow_id,
        step_order,
        action_type,
        action_config,
        delay_minutes,
        is_active
      )
      VALUES (
        workflow_id,
        COALESCE((definition_step->>'step_order')::int, 1),
        definition_step->>'action',
        action_config,
        COALESCE((definition_step->>'delay_minutes')::int, 0),
        true
      );
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_default_session_reminder_workflows(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  workflow_count INTEGER;
  total_workflows INTEGER;
  template_id UUID;
  workflow_id UUID;
  final_locale text := public.normalize_locale_code(public.get_org_locale(org_id), 'tr');
  workflow_name text;
  workflow_description text;
BEGIN
  SELECT COUNT(*) INTO total_workflows
  FROM public.workflows
  WHERE organization_id = org_id;

  IF total_workflows = 0 THEN
    -- Allow ensure_default_workflows_for_org to seed the full catalog later
    RETURN;
  END IF;

  SELECT COUNT(*) INTO workflow_count
  FROM public.workflows
  WHERE organization_id = org_id
    AND trigger_type = 'session_reminder';

  IF workflow_count > 0 THEN
    RETURN;
  END IF;

  PERFORM public.ensure_default_message_templates(user_uuid, org_id);

  SELECT id INTO template_id
  FROM public.message_templates
  WHERE organization_id = org_id
    AND template_slug = 'session_reminder'
  LIMIT 1;

  workflow_name := CASE final_locale
    WHEN 'tr' THEN 'Seans Hatırlatıcısı (3 gün)'
    ELSE 'Session Reminder (3 days)'
  END;

  workflow_description := CASE final_locale
    WHEN 'tr' THEN 'Seans tarihinden 72 saat önce e-posta gönderir.'
    ELSE 'Sends an email reminder 72 hours before the session.'
  END;

  INSERT INTO public.workflows (
    user_id,
    organization_id,
    name,
    description,
    trigger_type,
    trigger_conditions,
    is_active
  )
  VALUES (
    user_uuid,
    org_id,
    workflow_name,
    workflow_description,
    'session_reminder',
    jsonb_build_object('reminder_hours', 72),
    true
  ) RETURNING id INTO workflow_id;

  INSERT INTO public.workflow_steps (
    workflow_id,
    step_order,
    action_type,
    action_config,
    delay_minutes,
    is_active
  )
  VALUES (
    workflow_id,
    1,
    'send_notification',
    jsonb_build_object(
      'template_id', template_id,
      'template_slug', 'session_reminder',
      'channels', ARRAY['email']
    ),
    72 * 60,
    true
  );
END;
$function$;
