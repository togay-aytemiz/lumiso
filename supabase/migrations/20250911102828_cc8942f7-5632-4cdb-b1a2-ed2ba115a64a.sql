-- Fix session reminder scheduling with crystal clear logic
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
  org_timezone TEXT;
  session_workflow_id UUID;
  
  -- Specific reminder times
  one_week_before_utc TIMESTAMP WITH TIME ZONE;
  three_days_before_utc TIMESTAMP WITH TIME ZONE;
  one_day_before_utc TIMESTAMP WITH TIME ZONE;
  
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Get session details
  SELECT s.* INTO session_record
  FROM sessions s
  WHERE s.id = session_id_param;

  IF session_record IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;

  -- Get organization timezone
  SELECT os.timezone INTO org_timezone
  FROM organization_settings os
  WHERE os.organization_id = session_record.organization_id;

  -- Get the session workflow ID
  SELECT w.id INTO session_workflow_id
  FROM workflows w
  WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_scheduled'
    AND w.is_active = true
  LIMIT 1;

  IF session_workflow_id IS NULL THEN
    RAISE NOTICE 'No active session workflow found for organization %, skipping reminders', session_record.organization_id;
    RETURN;
  END IF;

  -- Combine session date and time as local timestamp
  session_datetime_local := (session_record.session_date || ' ' || session_record.session_time)::timestamp;
  
  -- Convert to UTC
  session_datetime_utc := session_datetime_local AT TIME ZONE COALESCE(org_timezone, 'UTC');

  -- Only schedule if session is in the future
  IF session_datetime_utc <= current_time THEN
    RAISE NOTICE 'Session % is in the past, not scheduling reminders', session_id_param;
    RETURN;
  END IF;

  -- Clean up any existing pending reminders for this session
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';

  -- Calculate exact reminder times
  one_week_before_utc := session_datetime_utc - INTERVAL '7 days';
  three_days_before_utc := session_datetime_utc - INTERVAL '3 days';
  one_day_before_utc := session_datetime_utc - INTERVAL '1 day';

  RAISE NOTICE 'Session % on % (UTC: %), current time: %', 
    session_id_param, session_datetime_local, session_datetime_utc, current_time;

  -- Schedule 1-week reminder (only if the reminder time is in the future)
  IF one_week_before_utc > current_time THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id,
      session_workflow_id,
      'Session reminder - 1 week', 
      one_week_before_utc,
      'pending'
    );
    RAISE NOTICE 'Scheduled 1-week reminder for session % at %', session_id_param, one_week_before_utc;
  ELSE
    RAISE NOTICE 'Skipped 1-week reminder for session % - reminder time % is in the past', 
      session_id_param, one_week_before_utc;
  END IF;

  -- Schedule 3-day reminder (only if the reminder time is in the future)
  IF three_days_before_utc > current_time THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id,
      session_workflow_id,
      'Session reminder - 3 days', 
      three_days_before_utc,
      'pending'
    );
    RAISE NOTICE 'Scheduled 3-day reminder for session % at %', session_id_param, three_days_before_utc;
  ELSE
    RAISE NOTICE 'Skipped 3-day reminder for session % - reminder time % is in the past', 
      session_id_param, three_days_before_utc;
  END IF;

  -- Schedule 1-day reminder (only if the reminder time is in the future)
  IF one_day_before_utc > current_time THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, workflow_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id,
      session_workflow_id,
      'Session reminder - 1 day', 
      one_day_before_utc,
      'pending'
    );
    RAISE NOTICE 'Scheduled 1-day reminder for session % at %', session_id_param, one_day_before_utc;
  ELSE
    RAISE NOTICE 'Skipped 1-day reminder for session % - reminder time % is in the past', 
      session_id_param, one_day_before_utc;
  END IF;

END;
$function$;

-- Clean up ALL existing reminders and reschedule correctly
DO $$
DECLARE
  session_rec RECORD;
  deleted_count INTEGER;
BEGIN
  -- Delete all existing pending reminders
  DELETE FROM scheduled_session_reminders WHERE status = 'pending';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % existing pending reminders', deleted_count;
  
  -- Reschedule all future sessions
  FOR session_rec IN 
    SELECT id, session_date, session_time FROM sessions 
    WHERE session_date >= CURRENT_DATE
    ORDER BY session_date, session_time
  LOOP
    RAISE NOTICE 'Rescheduling reminders for session % on % at %', 
      session_rec.id, session_rec.session_date, session_rec.session_time;
    PERFORM schedule_session_reminders(session_rec.id);
  END LOOP;
  
  RAISE NOTICE 'Reminder rescheduling completed';
END $$;