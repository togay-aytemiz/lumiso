-- Sample data seeding for orgs that opt in

CREATE OR REPLACE FUNCTION public.seed_sample_data_for_org(
  owner_uuid uuid,
  org_id uuid,
  final_locale text,
  preferred_slugs text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  existing boolean;
  lead_status_new RECORD;
  lead_status_proposal RECORD;
  lead_status_won RECORD;
  project_status_active RECORD;
  project_status_completed RECORD;
  session_type_primary RECORD;
  session_type_mini RECORD;
  package_primary RECORD;
  package_mini RECORD;
  project_type_primary uuid;
  project_type_secondary uuid;
  first_slug text;
  second_slug text;
  base_ts timestamptz := timezone('UTC', now());
  lead1 uuid := gen_random_uuid();
  lead2 uuid := gen_random_uuid();
  lead3 uuid := gen_random_uuid();
  project1 uuid := gen_random_uuid();
  project2 uuid := gen_random_uuid();
  session1 uuid := gen_random_uuid();
  session2 uuid := gen_random_uuid();
  session3 uuid := gen_random_uuid();
  locale_code text := COALESCE(final_locale, 'tr');
  lead_name1 text;
  lead_name2 text;
  lead_name3 text;
  session_label1 text;
  session_label2 text;
  session_label3 text;
  notes_prefix text := '[Sample Data] ';
  start_time timestamptz;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.leads
    WHERE organization_id = org_id
      AND notes ILIKE '%[Sample Data]%'
  ) INTO existing;

  IF existing THEN
    PERFORM public.log_intake_seeding_event(
      org_id,
      owner_uuid,
      'seed_sample_data_for_org',
      'skipped',
      'Sample data already exists for org.',
      jsonb_build_object('reason', 'existing_sample_data')
    );
    RETURN;
  END IF;

  start_time := clock_timestamp();

  PERFORM public.log_intake_seeding_event(
    org_id,
    owner_uuid,
    'seed_sample_data_for_org',
    'started',
    'Creating localized sample data set.',
    jsonb_build_object(
      'resolved_locale',
      locale_code,
      'preferred_project_type_slugs',
      preferred_slugs
    )
  );

  BEGIN
  IF locale_code LIKE 'tr%' THEN
    lead_name1 := 'Ayşe & Mehmet';
    lead_name2 := 'Zeynep Kılıç';
    lead_name3 := 'Ece & Bora';
    session_label1 := 'Düğün Çekimi';
    session_label2 := 'Aile Lifestyle';
    session_label3 := 'Mini Çekim';
  ELSE
    lead_name1 := 'Sarah & Daniel';
    lead_name2 := 'Olivia Carter';
    lead_name3 := 'Noah & Emma';
    session_label1 := 'Wedding Story';
    session_label2 := 'Family Lifestyle';
    session_label3 := 'Mini Session';
  END IF;

  SELECT id, name
  INTO lead_status_new
  FROM public.lead_statuses
  WHERE organization_id = org_id AND template_slug = 'new'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO lead_status_proposal
  FROM public.lead_statuses
  WHERE organization_id = org_id AND template_slug = 'proposal'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO lead_status_won
  FROM public.lead_statuses
  WHERE organization_id = org_id AND template_slug = 'won'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO project_status_active
  FROM public.project_statuses
  WHERE organization_id = org_id AND template_slug = 'in_progress'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO project_status_completed
  FROM public.project_statuses
  WHERE organization_id = org_id AND template_slug = 'completed'
  ORDER BY sort_order
  LIMIT 1;

  SELECT id, name
  INTO session_type_primary
  FROM public.session_types
  WHERE organization_id = org_id AND template_slug = 'signature_session'
  LIMIT 1;

  SELECT id, name
  INTO session_type_mini
  FROM public.session_types
  WHERE organization_id = org_id AND template_slug = 'mini_session'
  LIMIT 1;

  SELECT id, price, template_slug
  INTO package_primary
  FROM public.packages
  WHERE organization_id = org_id AND template_slug = 'wedding_story'
  LIMIT 1;

  SELECT id, price, template_slug
  INTO package_mini
  FROM public.packages
  WHERE organization_id = org_id AND template_slug = 'mini_lifestyle'
  LIMIT 1;

  first_slug := COALESCE(preferred_slugs[1], 'wedding');
  second_slug := COALESCE(preferred_slugs[2], 'family');

  SELECT id
  INTO project_type_primary
  FROM public.project_types
  WHERE organization_id = org_id
    AND (template_slug = first_slug OR name ILIKE initcap(first_slug))
  ORDER BY sort_order
  LIMIT 1;

  SELECT id
  INTO project_type_secondary
  FROM public.project_types
  WHERE organization_id = org_id
    AND id <> project_type_primary
    AND (template_slug = second_slug OR name ILIKE initcap(second_slug))
  ORDER BY sort_order
  LIMIT 1;

  INSERT INTO public.leads (
    id,
    organization_id,
    user_id,
    name,
    email,
    phone,
    status,
    status_id,
    notes,
    created_at,
    updated_at
  )
  VALUES
    (
      lead1,
      org_id,
      owner_uuid,
      lead_name1,
      'sample+wedding@lumiso.app',
      '+90 555 000 0001',
      COALESCE(lead_status_new.name, 'New'),
      lead_status_new.id,
      notes_prefix || 'Booked via expo show.',
      now(),
      now()
    ),
    (
      lead2,
      org_id,
      owner_uuid,
      lead_name2,
      'sample+family@lumiso.app',
      '+1 555 010 0002',
      COALESCE(lead_status_proposal.name, 'Proposal Sent'),
      lead_status_proposal.id,
      notes_prefix || 'Waiting for contract.',
      now(),
      now()
    ),
    (
      lead3,
      org_id,
      owner_uuid,
      lead_name3,
      'sample+mini@lumiso.app',
      '+90 555 000 0003',
      COALESCE(lead_status_won.name, 'Won'),
      lead_status_won.id,
      notes_prefix || 'Returning client from referral.',
      now(),
      now()
    );

  INSERT INTO public.projects (
    id,
    organization_id,
    user_id,
    lead_id,
    name,
    status_id,
    project_type_id,
    package_id,
    base_price,
    created_at,
    updated_at
  )
  VALUES
    (
      project1,
      org_id,
      owner_uuid,
      lead1,
      session_label1,
      project_status_active.id,
      project_type_primary,
      package_primary.id,
      package_primary.price,
      now(),
      now()
    ),
    (
      project2,
      org_id,
      owner_uuid,
      lead2,
      session_label2,
      project_status_completed.id,
      COALESCE(project_type_secondary, project_type_primary),
      package_mini.id,
      package_mini.price,
      now(),
      now()
    );

  INSERT INTO public.sessions (
    id,
    organization_id,
    user_id,
    lead_id,
    project_id,
    session_type_id,
    session_name,
    session_date,
    session_time,
    status,
    location,
    notes,
    created_at,
    updated_at
  )
  VALUES
    (
      session1,
      org_id,
      owner_uuid,
      lead1,
      project1,
      session_type_primary.id,
      session_label1,
      (base_ts + interval '10 days')::date::text,
      '15:00',
      'scheduled',
      'Old Town',
      notes_prefix || 'Shot list pinned in Notion board.',
      now(),
      now()
    ),
    (
      session2,
      org_id,
      owner_uuid,
      lead2,
      project2,
      session_type_primary.id,
      session_label2,
      (base_ts + interval '3 days')::date::text,
      '11:00',
      'completed',
      'City Park',
      notes_prefix || 'Delivered gallery last week.',
      now(),
      now()
    ),
    (
      session3,
      org_id,
      owner_uuid,
      lead3,
      project1,
      session_type_mini.id,
      session_label3,
      (base_ts + interval '18 days')::date::text,
      '09:30',
      'scheduled',
      'Studio Loft',
      notes_prefix || 'Mini session add-on.',
      now(),
      now()
    );
  
    PERFORM public.log_intake_seeding_event(
      org_id,
      owner_uuid,
      'seed_sample_data_for_org',
      'succeeded',
      'Sample data created.',
      jsonb_build_object(
        'resolved_locale',
        locale_code,
        'preferred_project_type_slugs',
        preferred_slugs,
        'duration_ms',
        FLOOR(EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000)
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM public.log_intake_seeding_event(
        org_id,
        owner_uuid,
        'seed_sample_data_for_org',
        'failed',
        'Sample data seeding failed.',
        jsonb_build_object(
          'resolved_locale',
          locale_code,
          'preferred_project_type_slugs',
          preferred_slugs
        ),
        SQLERRM
      );
      RAISE;
  END;
END;
$function$;
