-- Delivery method templates (localized) and workflow template catalog

CREATE TABLE IF NOT EXISTS public.default_delivery_method_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

INSERT INTO public.default_delivery_method_templates
  (locale, slug, name, description, sort_order)
VALUES
  ('en','digital_gallery','Digital Gallery','High-res gallery via Lumiso client portal.',1),
  ('en','usb_drive','Branded USB Drive','USB delivery for all retouched files.',2),
  ('tr','digital_gallery','Dijital Galeri','Lumiso müşteri portalı ile yüksek çözünürlüklü galeri.',1),
  ('tr','usb_drive','USB Bellek','Tüm düzenlenen dosyalar için markalı USB.',2)
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- Template table for workflows (serialized definition stored in JSON)
CREATE TABLE IF NOT EXISTS public.default_workflow_templates (
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'tr',
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_conditions jsonb,
  definition jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, slug)
);

INSERT INTO public.default_workflow_templates (
  locale,
  slug,
  name,
  description,
  trigger_type,
  trigger_conditions,
  definition,
  sort_order
)
VALUES
  (
    'en',
    'session_confirmation',
    'Auto-confirm session',
    'Send confirmation email immediately after booking.',
    'project_status_changed',
    jsonb_build_object('target_status_slug','planned'),
    jsonb_build_array(
      jsonb_build_object(
        'action','send_notification',
        'config',jsonb_build_object(
          'template_slug','session_confirmation',
          'channels',ARRAY['email']
        )
      )
    ),
    1
  ),
  (
    'en',
    'session_reminder_workflow',
    'Reminder 3 days before',
    'Send reminder email 3 days prior to the session.',
    'session_scheduled',
    jsonb_build_object('offset_hours',72),
    jsonb_build_array(
      jsonb_build_object(
        'action','send_notification',
        'config',jsonb_build_object(
          'template_slug','session_reminder',
          'channels',ARRAY['email']
        )
      )
    ),
    2
  ),
  (
    'tr',
    'session_confirmation',
    'Çekim Onayı Otomasyonu',
    'Rezervasyon sonrası onay e-postası gönderir.',
    'project_status_changed',
    jsonb_build_object('target_status_slug','planned'),
    jsonb_build_array(
      jsonb_build_object(
        'action','send_notification',
        'config',jsonb_build_object(
          'template_slug','session_confirmation',
          'channels',ARRAY['email']
        )
      )
    ),
    1
  ),
  (
    'tr',
    'session_reminder_workflow',
    '3 Gün Önce Hatırlatma',
    'Çekimden 3 gün önce hatırlatma e-postası gönderir.',
    'session_scheduled',
    jsonb_build_object('offset_hours',72),
    jsonb_build_array(
      jsonb_build_object(
        'action','send_notification',
        'config',jsonb_build_object(
          'template_slug','session_reminder',
          'channels',ARRAY['email']
        )
      )
    ),
    2
  )
ON CONFLICT (locale, slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    trigger_type = EXCLUDED.trigger_type,
    trigger_conditions = EXCLUDED.trigger_conditions,
    definition = EXCLUDED.definition,
    sort_order = EXCLUDED.sort_order;

-- Helper to seed delivery methods
CREATE OR REPLACE FUNCTION public.ensure_default_delivery_methods_for_org(owner_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  current_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.delivery_methods
  WHERE organization_id = org_id;

  IF current_count > 0 THEN
    RETURN;
  END IF;

  WITH prioritized AS (
    SELECT *, 1 AS priority
    FROM public.default_delivery_method_templates
    WHERE locale = final_locale
    UNION ALL
    SELECT *, 2
    FROM public.default_delivery_method_templates
    WHERE locale = 'en'
  ),
  chosen AS (
    SELECT DISTINCT ON (slug) *
    FROM prioritized
    ORDER BY slug, priority
  )
  INSERT INTO public.delivery_methods (
    id,
    organization_id,
    user_id,
    slug,
    name,
    description,
    sort_order,
    is_active
  )
  SELECT
    gen_random_uuid(),
    org_id,
    owner_uuid,
    slug,
    name,
    description,
    sort_order,
    true
  FROM chosen
  ORDER BY sort_order;
END;
$function$;

-- Helper to seed workflow templates as concrete workflows
CREATE OR REPLACE FUNCTION public.ensure_default_workflows_for_org(owner_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  existing_count integer;
  final_locale text := COALESCE(get_org_locale(org_id), 'tr');
  wf RECORD;
  template_slug text;
  workflow_id uuid;
  definition_step jsonb;
  template_id uuid;
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

      INSERT INTO public.workflow_steps (
        workflow_id,
        step_order,
        action_type,
        action_config,
        is_active
      )
      VALUES (
        workflow_id,
        COALESCE((definition_step->>'step_order')::int, 1),
        definition_step->>'action',
        jsonb_build_object(
          'template_id', template_id,
          'template_slug', template_slug,
          'channels', definition_step->'config'->'channels'
        ),
        true
      );
    END LOOP;
  END LOOP;
END;
$function$;

