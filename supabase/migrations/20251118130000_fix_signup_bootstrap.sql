-- Backport the single-owner signup bootstrap so auth triggers stop touching
-- the removed team tables (organization_members, invitations) and the
-- dropped user_settings.active_organization_id column. This fixes
-- "Database error saving new user" failures during signup.

CREATE OR REPLACE FUNCTION public.user_has_pending_membership(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- Team invitations were removed, so always return false.
  SELECT FALSE;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  org_id uuid;
  requested_name text;
BEGIN
  requested_name := NULLIF(btrim(NEW.raw_user_meta_data ->> 'organization_name'), '');
  IF requested_name IS NULL THEN
    requested_name := 'My Organization';
  END IF;

  INSERT INTO public.organizations (owner_id, name)
  VALUES (NEW.id, requested_name)
  RETURNING id INTO org_id;

  PERFORM public.ensure_user_settings(NEW.id);

  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'),
    (NEW.id, 2, true, '09:00', '17:00'),
    (NEW.id, 3, true, '09:00', '17:00'),
    (NEW.id, 4, true, '09:00', '17:00'),
    (NEW.id, 5, true, '09:00', '17:00'),
    (NEW.id, 6, false, '09:00', '17:00'),
    (NEW.id, 0, false, '09:00', '17:00')
  ON CONFLICT (user_id, day_of_week) DO NOTHING;

  PERFORM public.ensure_default_packages_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_project_types_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_lead_statuses_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_project_statuses_for_org(NEW.id, org_id);
  PERFORM public.ensure_default_session_statuses(NEW.id, org_id);
  PERFORM public.ensure_default_lead_field_definitions(org_id, NEW.id);
  PERFORM public.ensure_default_message_templates(NEW.id, org_id);
  PERFORM public.ensure_default_session_reminder_workflows(NEW.id, org_id);

  RETURN NEW;
END;
$function$;
