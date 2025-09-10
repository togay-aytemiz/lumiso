-- Fix the schedule_session_reminders function to use proper reminder types
-- and handle workflow delays correctly
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
  reminder_type_text TEXT;
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
  session_datetime_utc := (session_record.session_date || ' ' || session_record.session_time)::timestamp AT TIME ZONE org_timezone;
  
  RAISE LOG 'Session datetime in UTC: %, org timezone: %', session_datetime_utc, org_timezone;
  
  -- Find active session_reminder workflows (these should have delays representing when to send)
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
    
    -- Convert delay to proper reminder type
    CASE 
      WHEN workflow_record.delay_minutes = 60 THEN
        reminder_type_text := '1_hour';
      WHEN workflow_record.delay_minutes = 1440 THEN  -- 24 hours = 1 day
        reminder_type_text := '1_day';
      WHEN workflow_record.delay_minutes = 4320 THEN  -- 72 hours = 3 days  
        reminder_type_text := '3_days';
      WHEN workflow_record.delay_minutes = 10080 THEN  -- 168 hours = 1 week
        reminder_type_text := '1_week';
      ELSE
        -- Default to 1_day for other values
        reminder_type_text := '1_day';
    END CASE;
    
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
        reminder_type_text,
        reminder_datetime_utc,
        'pending'
      );
      
      RAISE LOG 'Scheduled % reminder for workflow % at %', reminder_type_text, workflow_record.name, reminder_datetime_utc;
    ELSE
      RAISE LOG 'Skipping past reminder for workflow % (would be at %)', workflow_record.name, reminder_datetime_utc;
    END IF;
  END LOOP;
  
END;
$$;