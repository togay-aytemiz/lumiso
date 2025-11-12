-- Trigger + helper to seed data after intake completion

CREATE TABLE IF NOT EXISTS public.intake_seeding_queue (
  organization_id uuid PRIMARY KEY,
  seed_sample_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE OR REPLACE FUNCTION public.enqueue_intake_seeding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.profile_intake_completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.intake_seeding_queue (organization_id, seed_sample_data, created_at, processed_at)
  VALUES (NEW.organization_id, COALESCE(NEW.seed_sample_data_onboarding, false), now(), NULL)
  ON CONFLICT (organization_id) DO UPDATE
  SET seed_sample_data = EXCLUDED.seed_sample_data,
      created_at = EXCLUDED.created_at,
      processed_at = NULL;

  PERFORM public.process_intake_seed(EXCLUDED.organization_id);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_enqueue_intake_seeding ON public.organization_settings;

CREATE TRIGGER trigger_enqueue_intake_seeding
AFTER UPDATE OF profile_intake_completed_at
ON public.organization_settings
FOR EACH ROW
WHEN (
  NEW.profile_intake_completed_at IS NOT NULL
  AND (OLD.profile_intake_completed_at IS NULL
    OR NEW.profile_intake_completed_at <> OLD.profile_intake_completed_at)
)
EXECUTE FUNCTION public.enqueue_intake_seeding();

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
    PERFORM public.ensure_default_project_types_for_org(
      owner_uuid,
      target_org_id,
      project_types,
      final_locale,
      true
    );

    PERFORM public.ensure_default_lead_statuses_for_org(owner_uuid, target_org_id);
    PERFORM public.ensure_default_project_statuses_for_org(owner_uuid, target_org_id);
    PERFORM public.ensure_default_session_statuses(owner_uuid, target_org_id);
    PERFORM public.ensure_default_services_for_org(owner_uuid, target_org_id);
    PERFORM public.ensure_default_session_types_for_org(owner_uuid, target_org_id);
    PERFORM public.ensure_default_packages_for_org(owner_uuid, target_org_id);
    PERFORM public.ensure_default_message_templates(owner_uuid, target_org_id);
    PERFORM public.ensure_default_session_reminder_workflows(owner_uuid, target_org_id);
    PERFORM public.ensure_default_delivery_methods_for_org(owner_uuid, target_org_id);
    PERFORM public.ensure_default_workflows_for_org(owner_uuid, target_org_id);

    IF queue_record.seed_sample_data THEN
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
          final_locale
        ),
        SQLERRM
      );
      RAISE;
  END;
END;
$function$;
