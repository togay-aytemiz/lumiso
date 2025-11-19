-- Temporary instrumentation to capture the exact database error that causes
-- signup to fail. This creates a small log table that we can query through
-- Supabase REST using the anon key, so remember to drop it once signup is
-- stable again.

CREATE TABLE IF NOT EXISTS public.signup_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  error_message text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read signup debug logs"
ON public.signup_debug_logs
FOR SELECT
TO anon, authenticated
USING (true);

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
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    err_msg := SQLERRM;
    GET STACKED DIAGNOSTICS err_detail = PG_EXCEPTION_DETAIL;

    INSERT INTO public.signup_debug_logs (user_id, error_message, error_detail)
    VALUES (NEW.id, err_msg, err_detail);

    RAISE;
  END;
END;
$function$;
