-- Assign session_type_id to existing sessions using organization defaults

DO $$
DECLARE
  org record;
  chosen_type uuid;
BEGIN
  FOR org IN
    SELECT
      o.id AS organization_id,
      o.owner_id,
      os.default_session_type_id
    FROM public.organizations o
    LEFT JOIN public.organization_settings os
      ON os.organization_id = o.id
  LOOP
    -- Ensure defaults exist for this organization
    PERFORM public.ensure_default_session_types_for_org(org.owner_id, org.organization_id);

    -- Re-fetch default in case it was set
    SELECT default_session_type_id
    INTO org.default_session_type_id
    FROM public.organization_settings
    WHERE organization_id = org.organization_id;

    chosen_type := org.default_session_type_id;

    -- If no default, attempt to pick the first active session type
    IF chosen_type IS NULL THEN
      SELECT id
      INTO chosen_type
      FROM public.session_types
      WHERE organization_id = org.organization_id
        AND is_active = true
      ORDER BY sort_order, created_at
      LIMIT 1;
    END IF;

    IF chosen_type IS NOT NULL THEN
      UPDATE public.sessions
      SET session_type_id = chosen_type
      WHERE organization_id = org.organization_id
        AND session_type_id IS NULL;
    END IF;
  END LOOP;
END;
$$;
