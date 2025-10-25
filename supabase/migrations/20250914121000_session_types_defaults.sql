-- Seed and manage default session types per organization

CREATE OR REPLACE FUNCTION public.ensure_default_session_types_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  type_count integer;
  primary_type_id uuid;
  settings_default uuid;
BEGIN
  -- Ensure organization settings exist (needed for default assignment)
  PERFORM public.ensure_organization_settings(org_id, NULL);

  SELECT COUNT(*) INTO type_count
  FROM public.session_types
  WHERE organization_id = org_id;

  IF type_count = 0 THEN
    -- Insert two sensible defaults for photography workflows
    INSERT INTO public.session_types (
      organization_id,
      user_id,
      name,
      description,
      category,
      duration_minutes,
      is_active,
      sort_order
    ) VALUES (
      org_id,
      user_uuid,
      'Signature Session',
      'Standard portrait session covering prep, shoot, and wrap-up.',
      'Photography',
      90,
      true,
      1
    )
    RETURNING id INTO primary_type_id;

    INSERT INTO public.session_types (
      organization_id,
      user_id,
      name,
      description,
      category,
      duration_minutes,
      is_active,
      sort_order
    ) VALUES (
      org_id,
      user_uuid,
      'Mini Session',
      'Short-form session ideal for seasonal promos or quick refreshers.',
      'Photography',
      30,
      true,
      2
    );
  END IF;

  -- If no default is set, pick the first active session type (prefer seeded primary)
  SELECT default_session_type_id
  INTO settings_default
  FROM public.organization_settings
  WHERE organization_id = org_id;

  IF settings_default IS NULL THEN
    IF primary_type_id IS NULL THEN
      SELECT id
      INTO primary_type_id
      FROM public.session_types
      WHERE organization_id = org_id
        AND is_active = true
      ORDER BY sort_order, created_at
      LIMIT 1;
    END IF;

    IF primary_type_id IS NOT NULL THEN
      UPDATE public.organization_settings
      SET default_session_type_id = primary_type_id,
          updated_at = now()
      WHERE organization_id = org_id;
    END IF;
  END IF;
END;
$function$;
