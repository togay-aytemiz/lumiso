-- Align default session message templates and workflow seeds

-- Ensure session confirmation templates always show location in the Session Details block
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
          'showLocation',true,
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
          'showLocation',true,
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

-- Apply the same Session Details block for reminder templates and include the location placeholder
UPDATE public.default_message_template_templates
SET placeholders = ARRAY['session_name','session_type','session_date','session_time','session_notes','location'],
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
          'showLocation',true,
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
SET placeholders = ARRAY['session_name','session_type','session_date','session_time','session_notes','location'],
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
          'showLocation',true,
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

-- Backfill reminder templates so the location placeholder exists for already-seeded orgs
UPDATE public.message_templates AS mt
SET placeholders = (
      CASE
        WHEN mt.placeholders::jsonb @> '["location"]'::jsonb THEN mt.placeholders
        ELSE (COALESCE(mt.placeholders::jsonb, '[]'::jsonb) || jsonb_build_array('location'))
      END
    )::jsonb
WHERE mt.template_slug = 'session_reminder';

UPDATE public.message_templates AS mt
SET blocks = (
      SELECT jsonb_agg(
               CASE
                 WHEN block->>'type' = 'session-details'
                   THEN jsonb_set(block, '{data,showLocation}', 'true'::jsonb, false)
                 ELSE block
               END
               ORDER BY ord
             )
      FROM jsonb_array_elements(COALESCE(mt.blocks, '[]'::jsonb)) WITH ORDINALITY AS elems(block, ord)
    )
WHERE mt.template_slug IN ('session_confirmation','session_reminder')
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(mt.blocks, '[]'::jsonb)) AS existing
    WHERE existing->>'type' = 'session-details'
      AND COALESCE(existing->'data'->>'showLocation', 'false') <> 'true'
  );

-- Ensure workflow template definitions expose the template slug for easier linkage
UPDATE public.default_workflow_templates
SET definition = jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'action', 'send_notification',
        'delay_minutes', 0,
        'template_slug', 'session_confirmation',
        'config', jsonb_build_object(
          'template_slug', 'session_confirmation',
          'channels', ARRAY['email']
        )
      )
    )
WHERE slug = 'session_confirmation' AND locale = 'en';

UPDATE public.default_workflow_templates
SET definition = jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'action', 'send_notification',
        'delay_minutes', 0,
        'template_slug', 'session_confirmation',
        'config', jsonb_build_object(
          'template_slug', 'session_confirmation',
          'channels', ARRAY['email']
        )
      )
    )
WHERE slug = 'session_confirmation' AND locale = 'tr';

UPDATE public.default_workflow_templates
SET definition = jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'action', 'send_notification',
        'delay_minutes', 4320,
        'template_slug', 'session_reminder',
        'config', jsonb_build_object(
          'template_slug', 'session_reminder',
          'channels', ARRAY['email']
        )
      )
    )
WHERE slug = 'session_reminder_workflow' AND locale = 'en';

UPDATE public.default_workflow_templates
SET definition = jsonb_build_array(
      jsonb_build_object(
        'step_order', 1,
        'action', 'send_notification',
        'delay_minutes', 4320,
        'template_slug', 'session_reminder',
        'config', jsonb_build_object(
          'template_slug', 'session_reminder',
          'channels', ARRAY['email']
        )
      )
    )
WHERE slug = 'session_reminder_workflow' AND locale = 'tr';

-- Refresh workflow seeding so template IDs are attached even when the definition stores the slug inside config
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

  PERFORM public.ensure_default_message_templates(owner_uuid, org_id);

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
      template_slug := COALESCE(
        definition_step->>'template_slug',
        (definition_step->'config')->>'template_slug'
      );

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

      IF template_slug IS NOT NULL AND action_config->>'template_slug' IS NULL THEN
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

-- Attach template IDs to already-seeded workflow steps so the builder sees the default templates
WITH missing_template AS (
  SELECT ws.id AS workflow_step_id,
         mt.id AS template_id
  FROM public.workflow_steps ws
  JOIN public.workflows w ON w.id = ws.workflow_id
  JOIN public.message_templates mt
    ON mt.organization_id = w.organization_id
   AND mt.template_slug = ws.action_config->>'template_slug'
  WHERE ws.action_type = 'send_notification'
    AND (ws.action_config->>'template_id') IS NULL
    AND ws.action_config ? 'template_slug'
)
UPDATE public.workflow_steps ws
SET action_config = COALESCE(ws.action_config, '{}'::jsonb) || jsonb_build_object('template_id', missing_template.template_id)
FROM missing_template
WHERE ws.id = missing_template.workflow_step_id;

-- Normalize reminder workflows to fire three days (72 hours) before the session
UPDATE public.workflows
SET trigger_conditions = jsonb_build_object('reminder_hours', 72)
WHERE trigger_type = 'session_reminder'
  AND COALESCE((trigger_conditions->>'reminder_hours')::int, 0) <> 72;

UPDATE public.workflow_steps ws
SET delay_minutes = 72 * 60
FROM public.workflows w
WHERE ws.workflow_id = w.id
  AND w.trigger_type = 'session_reminder'
  AND ws.action_type = 'send_notification'
  AND ws.step_order = 1
  AND COALESCE(ws.delay_minutes, 0) <> 72 * 60;
