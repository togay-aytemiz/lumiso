-- Telemetry for intake seeding and sample data helpers

CREATE TABLE IF NOT EXISTS public.intake_seeding_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  event_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'skipped')),
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intake_seeding_events IS 'Telemetry events for organization bootstrap + sample-data jobs.';

CREATE INDEX IF NOT EXISTS idx_intake_seeding_events_org_created_at
  ON public.intake_seeding_events (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_intake_seeding_event(
  target_org_id uuid,
  actor_user uuid,
  event_name text,
  status text,
  message text DEFAULT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  error_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.intake_seeding_events (
    organization_id,
    actor_user_id,
    event_name,
    status,
    message,
    payload,
    error_detail
  ) VALUES (
    target_org_id,
    actor_user,
    event_name,
    status,
    message,
    COALESCE(payload, '{}'::jsonb),
    error_detail
  );
END;
$function$;
