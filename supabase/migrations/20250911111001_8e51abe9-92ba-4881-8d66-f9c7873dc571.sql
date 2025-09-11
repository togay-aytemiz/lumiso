-- Update schedule_session_reminders function to handle organization timezone properly
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
  org_timezone TEXT;
  session_datetime_utc TIMESTAMP WITH TIME ZONE;
  workflow_record RECORD;
  reminder_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get session details with organization info
  SELECT s.*, os.timezone as org_timezone
  INTO session_record
  FROM sessions s
  JOIN organization_settings os ON s.organization_id = os.organization_id
  WHERE s.id = session_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;

  -- Get organization timezone, default to UTC if not set
  org_timezone := COALESCE(session_record.org_timezone, 'UTC');

  -- Convert session date/time from organization timezone to UTC
  -- The session_date and session_time are stored as user entered them (in org timezone)
  session_datetime_utc := (session_record.session_date::text || ' ' || session_record.session_time::text)::timestamp AT TIME ZONE org_timezone;

  RAISE NOTICE 'Session datetime in org timezone: % %, converted to UTC: %', 
    session_record.session_date, session_record.session_time, session_datetime_utc;

  -- Delete any existing pending reminders for this session
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param 
  AND status = 'pending';

  -- Find active workflows for session reminders
  FOR workflow_record IN
    SELECT w.id, w.name, w.trigger_conditions
    FROM workflows w
    WHERE w.organization_id = session_record.organization_id
      AND w.trigger_type = 'session_scheduled'
      AND w.is_active = true
  LOOP
    -- Schedule 1-week reminder (7 days before)
    IF (workflow_record.trigger_conditions->>'reminder_type') = 'Session reminder - 1 week' THEN
      reminder_timestamp := session_datetime_utc - INTERVAL '7 days';
      
      -- Only schedule if reminder time is in the future
      IF reminder_timestamp > NOW() THEN
        INSERT INTO scheduled_session_reminders (
          organization_id, session_id, workflow_id, reminder_type, scheduled_for
        ) VALUES (
          session_record.organization_id, session_id_param, workflow_record.id,
          'Session reminder - 1 week', reminder_timestamp
        );
        
        RAISE NOTICE 'Scheduled 1-week reminder for: %', reminder_timestamp;
      END IF;
    END IF;

    -- Schedule 3-day reminder (3 days before)
    IF (workflow_record.trigger_conditions->>'reminder_type') = 'Session reminder - 3 days' THEN
      reminder_timestamp := session_datetime_utc - INTERVAL '3 days';
      
      -- Only schedule if reminder time is in the future
      IF reminder_timestamp > NOW() THEN
        INSERT INTO scheduled_session_reminders (
          organization_id, session_id, workflow_id, reminder_type, scheduled_for
        ) VALUES (
          session_record.organization_id, session_id_param, workflow_record.id,
          'Session reminder - 3 days', reminder_timestamp
        );
        
        RAISE NOTICE 'Scheduled 3-day reminder for: %', reminder_timestamp;
      END IF;
    END IF;

    -- Schedule 1-day reminder (1 day before)
    IF (workflow_record.trigger_conditions->>'reminder_type') = 'Session reminder - 1 day' THEN
      reminder_timestamp := session_datetime_utc - INTERVAL '1 day';
      
      -- Only schedule if reminder time is in the future
      IF reminder_timestamp > NOW() THEN
        INSERT INTO scheduled_session_reminders (
          organization_id, session_id, workflow_id, reminder_type, scheduled_for
        ) VALUES (
          session_record.organization_id, session_id_param, workflow_record.id,
          'Session reminder - 1 day', reminder_timestamp
        );
        
        RAISE NOTICE 'Scheduled 1-day reminder for: %', reminder_timestamp;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Completed scheduling reminders for session: %', session_id_param;
END;
$$;