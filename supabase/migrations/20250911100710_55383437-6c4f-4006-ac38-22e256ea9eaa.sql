-- Fix timezone handling in session reminder scheduling
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  session_datetime_local TIMESTAMP;
  session_datetime_utc TIMESTAMP WITH TIME ZONE;
  reminder_datetime_utc TIMESTAMP WITH TIME ZONE;
  org_timezone TEXT;
  existing_count INTEGER;
  session_workflow_id UUID;
  time_until_session INTERVAL;
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

  -- Combine session date and time as local timestamp (no timezone)
  session_datetime_local := (session_record.session_date || ' ' || session_record.session_time)::timestamp;
  
  -- Convert to UTC by treating the local timestamp as being in the organization's timezone
  session_datetime_utc := session_datetime_local AT TIME ZONE COALESCE(org_timezone, 'UTC');

  -- Calculate time until session
  time_until_session := session_datetime_utc - NOW();

  -- Only schedule if session is in the future
  IF session_datetime_utc <= NOW() THEN
    RAISE NOTICE 'Session % is in the past or too close, not scheduling reminders', session_id_param;
    RETURN;
  END IF;

  -- Clean up any existing pending reminders for this session to prevent duplicates
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';

  -- Schedule 1-day reminder (only if session is more than 24 hours away)
  IF time_until_session > INTERVAL '1 day' THEN
    -- Calculate reminder time in local timezone, then convert to UTC
    reminder_datetime_utc := (session_datetime_local - INTERVAL '1 day') AT TIME ZONE COALESCE(org_timezone, 'UTC');
    IF reminder_datetime_utc > NOW() THEN
      INSERT INTO scheduled_session_reminders (
        session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
      ) VALUES (
        session_id_param, 
        session_record.organization_id,
        session_workflow_id,
        'Session reminder - 1 day', 
        reminder_datetime_utc,
        'pending'
      );
      RAISE NOTICE 'Scheduled 1-day reminder for session % at % UTC (local: %)', 
        session_id_param, reminder_datetime_utc, session_datetime_local - INTERVAL '1 day';
    END IF;
  ELSE
    RAISE NOTICE 'Skipped 1-day reminder for session % - not enough time (% until session)', session_id_param, time_until_session;
  END IF;

  -- Schedule 3-day reminder (only if session is more than 72 hours away)
  IF time_until_session > INTERVAL '3 days' THEN
    -- Calculate reminder time in local timezone, then convert to UTC
    reminder_datetime_utc := (session_datetime_local - INTERVAL '3 days') AT TIME ZONE COALESCE(org_timezone, 'UTC');
    IF reminder_datetime_utc > NOW() THEN
      INSERT INTO scheduled_session_reminders (
        session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
      ) VALUES (
        session_id_param, 
        session_record.organization_id,
        session_workflow_id,
        'Session reminder - 3 days', 
        reminder_datetime_utc,
        'pending'
      );
      RAISE NOTICE 'Scheduled 3-day reminder for session % at % UTC (local: %)', 
        session_id_param, reminder_datetime_utc, session_datetime_local - INTERVAL '3 days';
    END IF;
  ELSE
    RAISE NOTICE 'Skipped 3-day reminder for session % - not enough time (% until session)', session_id_param, time_until_session;
  END IF;

  -- Schedule 1-week reminder (only if session is more than 7 days away)
  IF time_until_session > INTERVAL '1 week' THEN
    -- Calculate reminder time in local timezone, then convert to UTC
    reminder_datetime_utc := (session_datetime_local - INTERVAL '1 week') AT TIME ZONE COALESCE(org_timezone, 'UTC');
    IF reminder_datetime_utc > NOW() THEN
      INSERT INTO scheduled_session_reminders (
        session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
      ) VALUES (
        session_id_param, 
        session_record.organization_id,
        session_workflow_id,
        'Session reminder - 1 week', 
        reminder_datetime_utc,
        'pending'
      );
      RAISE NOTICE 'Scheduled 1-week reminder for session % at % UTC (local: %)', 
        session_id_param, reminder_datetime_utc, session_datetime_local - INTERVAL '1 week';
    END IF;
  ELSE
    RAISE NOTICE 'Skipped 1-week reminder for session % - not enough time (% until session)', session_id_param, time_until_session;
  END IF;

  -- Log what was scheduled
  SELECT COUNT(*) INTO existing_count
  FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';
  
  RAISE NOTICE 'Scheduled % reminders for session % (local datetime: %, UTC: %) with workflow %', 
    existing_count, session_id_param, session_datetime_local, session_datetime_utc, session_workflow_id;
END;
$function$;

-- Clean up existing incorrect reminders and reschedule them properly
DO $$
DECLARE
  session_rec RECORD;
BEGIN
  -- Delete all existing pending reminders that might be incorrectly scheduled
  DELETE FROM scheduled_session_reminders WHERE status = 'pending';
  
  -- Reschedule all future sessions
  FOR session_rec IN 
    SELECT id FROM sessions 
    WHERE session_date >= CURRENT_DATE
  LOOP
    PERFORM schedule_session_reminders(session_rec.id);
  END LOOP;
END $$;