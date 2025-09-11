-- Fix the schedule_session_reminders function to properly associate workflow IDs
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
  session_datetime TIMESTAMP WITH TIME ZONE;
  reminder_datetime TIMESTAMP WITH TIME ZONE;
  org_timezone TEXT;
  existing_count INTEGER;
  session_workflow_id UUID;
BEGIN
  -- Get session details and timezone in separate queries
  SELECT s.* INTO session_record
  FROM sessions s
  WHERE s.id = session_id_param;

  SELECT os.timezone INTO org_timezone
  FROM organization_settings os
  WHERE os.organization_id = session_record.organization_id;

  -- Get the session workflow ID (there should be one active workflow for session_scheduled)
  SELECT w.id INTO session_workflow_id
  FROM workflows w
  WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_scheduled'
    AND w.is_active = true
  LIMIT 1;

  IF session_record IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;

  IF session_workflow_id IS NULL THEN
    RAISE NOTICE 'No active session workflow found for organization %, skipping reminders', session_record.organization_id;
    RETURN;
  END IF;

  -- Convert session date/time to timestamp with timezone
  session_datetime := (session_record.session_date || ' ' || session_record.session_time)::timestamp;
  session_datetime := session_datetime AT TIME ZONE COALESCE(org_timezone, 'UTC');

  -- Only schedule if session is in the future
  IF session_datetime <= NOW() THEN
    RAISE NOTICE 'Session % is in the past or too close, not scheduling reminders', session_id_param;
    RETURN;
  END IF;

  -- Clean up any existing pending reminders for this session to prevent duplicates
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';

  -- Schedule 1-day reminder (exactly 24 hours before)
  reminder_datetime := session_datetime - INTERVAL '1 day';
  IF reminder_datetime > NOW() THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id,
      session_workflow_id,
      'Session reminder - 1 day', 
      reminder_datetime,
      'pending'
    );
  END IF;

  -- Schedule 3-day reminder (exactly 72 hours before)
  reminder_datetime := session_datetime - INTERVAL '3 days';
  IF reminder_datetime > NOW() THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id,
      session_workflow_id,
      'Session reminder - 3 days', 
      reminder_datetime,
      'pending'
    );
  END IF;

  -- Schedule 1-week reminder (exactly 7 days before)
  reminder_datetime := session_datetime - INTERVAL '1 week';
  IF reminder_datetime > NOW() THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id,
      session_workflow_id,
      'Session reminder - 1 week', 
      reminder_datetime,
      'pending'
    );
  END IF;

  -- Log what was scheduled
  SELECT COUNT(*) INTO existing_count
  FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';
  
  RAISE NOTICE 'Scheduled % reminders for session % (datetime: %) with workflow %', 
    existing_count, session_id_param, session_datetime, session_workflow_id;
END;
$$;