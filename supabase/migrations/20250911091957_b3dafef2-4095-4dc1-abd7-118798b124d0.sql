-- Fix the schedule_session_reminders function to properly validate time gaps
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  session_datetime TIMESTAMP WITH TIME ZONE;
  reminder_datetime TIMESTAMP WITH TIME ZONE;
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

  -- Convert session date/time to timestamp with timezone
  session_datetime := (session_record.session_date || ' ' || session_record.session_time)::timestamp;
  session_datetime := session_datetime AT TIME ZONE COALESCE(org_timezone, 'UTC');

  -- Calculate time until session
  time_until_session := session_datetime - NOW();

  -- Only schedule if session is in the future
  IF session_datetime <= NOW() THEN
    RAISE NOTICE 'Session % is in the past or too close, not scheduling reminders', session_id_param;
    RETURN;
  END IF;

  -- Clean up any existing pending reminders for this session to prevent duplicates
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';

  -- Schedule 1-day reminder (only if session is more than 24 hours away)
  IF time_until_session > INTERVAL '1 day' THEN
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
      RAISE NOTICE 'Scheduled 1-day reminder for session % at %', session_id_param, reminder_datetime;
    END IF;
  ELSE
    RAISE NOTICE 'Skipped 1-day reminder for session % - not enough time (% until session)', session_id_param, time_until_session;
  END IF;

  -- Schedule 3-day reminder (only if session is more than 72 hours away)
  IF time_until_session > INTERVAL '3 days' THEN
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
      RAISE NOTICE 'Scheduled 3-day reminder for session % at %', session_id_param, reminder_datetime;
    END IF;
  ELSE
    RAISE NOTICE 'Skipped 3-day reminder for session % - not enough time (% until session)', session_id_param, time_until_session;
  END IF;

  -- Schedule 1-week reminder (only if session is more than 7 days away)
  IF time_until_session > INTERVAL '1 week' THEN
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
      RAISE NOTICE 'Scheduled 1-week reminder for session % at %', session_id_param, reminder_datetime;
    END IF;
  ELSE
    RAISE NOTICE 'Skipped 1-week reminder for session % - not enough time (% until session)', session_id_param, time_until_session;
  END IF;

  -- Log what was scheduled
  SELECT COUNT(*) INTO existing_count
  FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';
  
  RAISE NOTICE 'Scheduled % reminders for session % (datetime: %) with workflow %', 
    existing_count, session_id_param, session_datetime, session_workflow_id;
END;
$function$;

-- Clean up any existing incorrect reminders that violate the new time rules
DELETE FROM scheduled_session_reminders sr
WHERE sr.status = 'pending'
AND EXISTS (
  SELECT 1 FROM sessions s
  WHERE s.id = sr.session_id
  AND (
    -- Remove 1-day reminders if session is less than 24 hours away
    (sr.reminder_type = 'Session reminder - 1 day' AND (s.session_date || ' ' || s.session_time)::timestamp - NOW() <= INTERVAL '1 day')
    OR
    -- Remove 3-day reminders if session is less than 72 hours away
    (sr.reminder_type = 'Session reminder - 3 days' AND (s.session_date || ' ' || s.session_time)::timestamp - NOW() <= INTERVAL '3 days')
    OR
    -- Remove 1-week reminders if session is less than 7 days away
    (sr.reminder_type = 'Session reminder - 1 week' AND (s.session_date || ' ' || s.session_time)::timestamp - NOW() <= INTERVAL '1 week')
  )
);

-- Reschedule all existing future sessions with the corrected logic
DO $$
DECLARE
  session_rec RECORD;
  reminder_count INTEGER;
BEGIN
  -- For each future session, reschedule with proper time validation
  FOR session_rec IN 
    SELECT DISTINCT s.id, s.session_date, s.session_time
    FROM sessions s
    WHERE s.session_date > CURRENT_DATE
    ORDER BY s.session_date
  LOOP
    -- Log what we're doing
    RAISE NOTICE 'Rescheduling session % (date: %)', 
      session_rec.id, session_rec.session_date;
    
    -- Call the fixed function to reschedule with proper time validation
    PERFORM public.schedule_session_reminders(session_rec.id);
  END LOOP;
  
  -- Log summary
  SELECT COUNT(*) INTO reminder_count
  FROM scheduled_session_reminders sr
  JOIN sessions s ON sr.session_id = s.id
  WHERE s.session_date > CURRENT_DATE AND sr.status = 'pending';
  
  RAISE NOTICE 'Completed rescheduling with time validation. Total pending reminders: %', reminder_count;
END $$;