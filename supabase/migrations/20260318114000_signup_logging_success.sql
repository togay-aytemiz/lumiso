-- Log the execution path for signup triggers so we know which ones run.

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  err_msg text;
  err_detail text;
  err_context text;
BEGIN
  INSERT INTO public.signup_debug_logs (user_id, source, error_message)
  VALUES (NEW.id, 'handle_new_user_profile', 'start');

  BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.signup_debug_logs (user_id, source, error_message)
    VALUES (NEW.id, 'handle_new_user_profile', 'success');

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    err_msg := SQLERRM;
    GET STACKED DIAGNOSTICS err_detail = PG_EXCEPTION_DETAIL,
                            err_context = PG_EXCEPTION_CONTEXT;

    INSERT INTO public.signup_debug_logs (user_id, source, error_message, error_detail, error_context)
    VALUES (NEW.id, 'handle_new_user_profile', err_msg, err_detail, err_context);

    RAISE;
  END;
END;
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
  err_msg text;
  err_detail text;
  err_context text;
BEGIN
  INSERT INTO public.signup_debug_logs (user_id, source, error_message)
  VALUES (NEW.id, 'handle_new_user_organization', 'start');

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

    INSERT INTO public.signup_debug_logs (user_id, source, error_message)
    VALUES (NEW.id, 'handle_new_user_organization', 'success');

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    err_msg := SQLERRM;
    GET STACKED DIAGNOSTICS err_detail = PG_EXCEPTION_DETAIL,
                            err_context = PG_EXCEPTION_CONTEXT;

    INSERT INTO public.signup_debug_logs (user_id, source, error_message, error_detail, error_context)
    VALUES (NEW.id, 'handle_new_user_organization', err_msg, err_detail, err_context);

    RAISE;
  END;
END;
$function$;
