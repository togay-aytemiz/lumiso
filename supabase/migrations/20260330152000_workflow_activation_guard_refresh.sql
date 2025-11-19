-- Reapply workflow activation safeguards with a fresh migration

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
  step_template_slug text;
  workflow_id uuid;
  definition_step jsonb;
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
      false -- keep inactive until a template is selected
    ) RETURNING id INTO workflow_id;

    FOR definition_step IN SELECT * FROM jsonb_array_elements(wf.definition)
    LOOP
      step_template_slug := COALESCE(
        definition_step->>'template_slug',
        (definition_step->'config')->>'template_slug'
      );

      action_config := COALESCE(definition_step->'config', '{}'::jsonb);

      IF step_template_slug IS NOT NULL AND action_config->>'template_slug' IS NULL THEN
        action_config := action_config || jsonb_build_object('template_slug', step_template_slug);
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

UPDATE public.workflows w
SET is_active = false
FROM public.workflow_steps ws
WHERE ws.workflow_id = w.id
  AND ws.action_type = 'send_notification'
  AND (ws.action_config->>'template_id') IS NULL
  AND w.is_active = true;
