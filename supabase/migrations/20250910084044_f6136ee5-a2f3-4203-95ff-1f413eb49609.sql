-- Function to schedule session reminders when a session is created
CREATE OR REPLACE FUNCTION schedule_session_reminders(session_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
  org_timezone TEXT;
  session_datetime_utc TIMESTAMPTZ;
  reminder_datetime_utc TIMESTAMPTZ;
  workflow_record RECORD;
BEGIN
  -- Get session details with organization info
  SELECT s.*, o.id as org_id INTO session_record
  FROM sessions s
  JOIN organizations o ON s.organization_id = o.id
  WHERE s.id = session_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;
  
  -- Get organization timezone (default to UTC if not set)
  SELECT COALESCE(os.timezone, 'UTC') INTO org_timezone
  FROM organization_settings os
  WHERE os.organization_id = session_record.organization_id;
  
  -- Convert session date + time to UTC using organization timezone
  -- First create a timestamp in the organization timezone, then convert to UTC
  session_datetime_utc := (session_record.session_date || ' ' || session_record.session_time)::timestamp AT TIME ZONE org_timezone;
  
  RAISE LOG 'Session datetime in UTC: %, org timezone: %', session_datetime_utc, org_timezone;
  
  -- Find active workflows that trigger on session_reminder with delay
  FOR workflow_record IN
    SELECT w.id, w.name, ws.delay_minutes, ws.action_config
    FROM workflows w
    JOIN workflow_steps ws ON w.id = ws.workflow_id
    WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
    AND ws.is_active = true
    AND ws.delay_minutes > 0
    ORDER BY ws.step_order
  LOOP
    -- Calculate reminder time: session time MINUS delay (for "before" reminders)
    reminder_datetime_utc := session_datetime_utc - (workflow_record.delay_minutes || ' minutes')::INTERVAL;
    
    -- Only schedule if reminder is in the future
    IF reminder_datetime_utc > NOW() THEN
      INSERT INTO scheduled_session_reminders (
        organization_id,
        session_id,
        workflow_id,
        reminder_type,
        scheduled_for,
        status
      ) VALUES (
        session_record.organization_id,
        session_id_param,
        workflow_record.id,
        workflow_record.delay_minutes || '_minutes_before',
        reminder_datetime_utc,
        'pending'
      );
      
      RAISE LOG 'Scheduled reminder for workflow % at %', workflow_record.name, reminder_datetime_utc;
    ELSE
      RAISE LOG 'Skipping past reminder for workflow % (would be at %)', workflow_record.name, reminder_datetime_utc;
    END IF;
  END LOOP;
  
END;
$$;

-- Function to cleanup old session reminders
CREATE OR REPLACE FUNCTION cleanup_old_session_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete reminders older than 7 days that are completed or failed
  DELETE FROM scheduled_session_reminders 
  WHERE created_at < NOW() - INTERVAL '7 days'
  AND status IN ('sent', 'failed', 'cancelled');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;