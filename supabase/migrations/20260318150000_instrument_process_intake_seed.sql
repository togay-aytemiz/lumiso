-- Add step-aware error reporting to process_intake_seed so we can see which
-- helper raises \"query has no destination\".

CREATE OR REPLACE FUNCTION public.process_intake_seed(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  queue_record RECORD;
  owner_uuid uuid;
  project_types text[];
  final_locale text;
  start_time timestamptz;
  current_step text := 'preflight';
BEGIN
  SELECT *
  INTO queue_record
  FROM public.intake_seeding_queue
  WHERE organization_id = target_org_id
    AND processed_at IS NULL
  LIMIT 1;

  IF queue_record IS NULL THEN
    PERFORM public.log_intake_seeding_event(
      target_org_id,
      NULL,
      'process_intake_seed',
      'skipped',
      'No pending queue entry for org.',
      jsonb_build_object('reason', 'queue_entry_missing')
    );
    RETURN;
  END IF;

  SELECT owner_id
  INTO owner_uuid
  FROM public.organizations
  WHERE id = target_org_id;

  IF owner_uuid IS NULL THEN
    PERFORM public.log_intake_seeding_event(
      target_org_id,
      NULL,
      'process_intake_seed',
      'failed',
      'Organization owner missing.',
      jsonb_build_object('reason', 'owner_missing'),
      'owner_id is null'
    );
    RETURN;
  END IF;

  SELECT preferred_project_types
  INTO project_types
  FROM public.organization_settings
  WHERE organization_id = target_org_id;
  final_locale := public.get_org_locale(target_org_id);

  start_time := clock_timestamp();

  PERFORM public.log_intake_seeding_event(
    target_org_id,
    owner_uuid,
    'process_intake_seed',
    'started',
    'Seeding defaults queued.',
    jsonb_build_object(
      'seed_sample_data',
      queue_record.seed_sample_data,
      'preferred_project_types_count',
      COALESCE(array_length(project_types, 1), 0),
      'resolved_locale',
      final_locale
    )
  );

  BEGIN
    current_step := 'ensure_default_project_types_for_org';
    PERFORM public.ensure_default_project_types_for_org(
      owner_uuid,
      target_org_id,
      project_types,
      final_locale,
      true
    );

    current_step := 'ensure_default_lead_statuses_for_org';
    PERFORM public.ensure_default_lead_statuses_for_org(owner_uuid, target_org_id);

    current_step := 'ensure_default_project_statuses_for_org';
    PERFORM public.ensure_default_project_statuses_for_org(owner_uuid, target_org_id);

    current_step := 'ensure_default_session_statuses';
    PERFORM public.ensure_default_session_statuses(owner_uuid, target_org_id);

    current_step := 'ensure_default_services_for_org';
    PERFORM public.ensure_default_services_for_org(owner_uuid, target_org_id);

    current_step := 'ensure_default_session_types_for_org';
    PERFORM public.ensure_default_session_types_for_org(owner_uuid, target_org_id);

    current_step := 'ensure_default_packages_for_org';
    PERFORM public.ensure_default_packages_for_org(owner_uuid, target_org_id);

    current_step := 'ensure_default_message_templates';
    PERFORM public.ensure_default_message_templates(owner_uuid, target_org_id);

    current_step := 'ensure_default_session_reminder_workflows';
    PERFORM public.ensure_default_session_reminder_workflows(owner_uuid, target_org_id);

    current_step := 'ensure_default_delivery_methods_for_org';
    PERFORM public.ensure_default_delivery_methods_for_org(owner_uuid, target_org_id);

    current_step := 'ensure_default_workflows_for_org';
    PERFORM public.ensure_default_workflows_for_org(owner_uuid, target_org_id);

    IF queue_record.seed_sample_data THEN
      current_step := 'seed_sample_data_for_org';
      PERFORM public.seed_sample_data_for_org(
        owner_uuid,
        target_org_id,
        final_locale,
        project_types
      );
    END IF;

    UPDATE public.intake_seeding_queue
    SET processed_at = now()
    WHERE organization_id = target_org_id;

    PERFORM public.log_intake_seeding_event(
      target_org_id,
      owner_uuid,
      'process_intake_seed',
      'succeeded',
      'Seeding completed.',
      jsonb_build_object(
        'seed_sample_data',
        queue_record.seed_sample_data,
        'resolved_locale',
        final_locale,
        'duration_ms',
        FLOOR(EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000)
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM public.log_intake_seeding_event(
        target_org_id,
        owner_uuid,
        'process_intake_seed',
        'failed',
        'Seeding failed.',
        jsonb_build_object(
          'seed_sample_data',
          queue_record.seed_sample_data,
          'resolved_locale',
          final_locale,
          'current_step',
          current_step
        ),
        SQLERRM
      );
      RAISE EXCEPTION 'process_intake_seed failed in step %: %', current_step, SQLERRM
        USING ERRCODE = SQLSTATE;
  END;
END;
$function$;
