-- Drop and recreate schedule_session_reminders function with workflow-based intelligent scheduling
DROP FUNCTION IF EXISTS public.schedule_session_reminders(uuid);

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
  days_until_session NUMERIC;
  delay_days NUMERIC;
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
  session_datetime_utc := (session_record.session_date::text || ' ' || session_record.session_time::text)::timestamp AT TIME ZONE org_timezone;

  -- Calculate days until session
  days_until_session := EXTRACT(EPOCH FROM (session_datetime_utc - NOW())) / 86400.0;

  RAISE NOTICE 'Session datetime UTC: %, Days until session: %', session_datetime_utc, days_until_session;

  -- Delete any existing pending reminders for this session
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param 
  AND status = 'pending';

  -- Find active session reminder workflows with their delay settings
  FOR workflow_record IN
    SELECT w.id, w.name, ws.delay_minutes
    FROM workflows w
    JOIN workflow_steps ws ON w.id = ws.workflow_id
    WHERE w.organization_id = session_record.organization_id
      AND w.trigger_type = 'session_reminder'
      AND w.is_active = true
      AND ws.is_active = true
  LOOP
    -- Convert delay_minutes to days
    delay_days := workflow_record.delay_minutes / 1440.0;
    
    -- Calculate reminder timestamp
    reminder_timestamp := session_datetime_utc - (workflow_record.delay_minutes || ' minutes')::INTERVAL;
    
    -- Only schedule if:
    -- 1. Reminder time is in the future
    -- 2. Session is far enough in future for this reminder type
    IF reminder_timestamp > NOW() AND days_until_session >= delay_days THEN
      -- Determine reminder type based on delay
      DECLARE
        reminder_type_name TEXT;
      BEGIN
        CASE 
          WHEN workflow_record.delay_minutes >= 10080 THEN -- 7 days or more
            reminder_type_name := 'Session reminder - 1 week';
          WHEN workflow_record.delay_minutes >= 4320 THEN -- 3 days or more
            reminder_type_name := 'Session reminder - 3 days';
          WHEN workflow_record.delay_minutes >= 1440 THEN -- 1 day or more
            reminder_type_name := 'Session reminder - 1 day';
          WHEN workflow_record.delay_minutes >= 60 THEN -- 1 hour or more
            reminder_type_name := 'Session reminder - 1 hour';
          ELSE
            reminder_type_name := 'Session reminder - ' || workflow_record.delay_minutes || ' minutes';
        END CASE;

        INSERT INTO scheduled_session_reminders (
          organization_id, session_id, workflow_id, reminder_type, scheduled_for
        ) VALUES (
          session_record.organization_id, session_id_param, workflow_record.id,
          reminder_type_name, reminder_timestamp
        );
        
        RAISE NOTICE 'Scheduled % (% minutes before) for: %', reminder_type_name, workflow_record.delay_minutes, reminder_timestamp;
      END;
    ELSE
      RAISE NOTICE 'Skipped reminder % minutes before - either too late or session too soon', workflow_record.delay_minutes;
    END IF;
  END LOOP;

  RAISE NOTICE 'Completed scheduling reminders for session: %', session_id_param;
END;
$$;