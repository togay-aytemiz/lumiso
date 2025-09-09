-- Create default session reminder workflows for existing organizations
-- This is a one-time setup to ensure all existing orgs have session reminder workflows

DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT o.id as org_id, o.owner_id as user_id 
    FROM public.organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.workflows w 
      WHERE w.organization_id = o.id 
      AND w.trigger_type = 'session_reminder'
    )
  LOOP
    PERFORM public.ensure_default_session_reminder_workflows(org_record.user_id, org_record.org_id);
  END LOOP;
END;
$$;