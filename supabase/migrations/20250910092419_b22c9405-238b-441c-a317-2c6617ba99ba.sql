-- Fix duplicate email and timing issues

-- 1. Remove the delay from session reminder workflow steps
-- The scheduling function already calculates the correct time
UPDATE workflow_steps 
SET delay_minutes = 0,
    updated_at = NOW()
WHERE workflow_id IN (
  SELECT id FROM workflows 
  WHERE trigger_type = 'session_reminder' 
  AND is_active = true
)
AND delay_minutes > 0;

-- 2. Clean up any duplicate or incorrectly scheduled reminders
DELETE FROM scheduled_session_reminders 
WHERE status = 'pending' 
AND scheduled_for < NOW() - INTERVAL '1 hour';

-- 3. Update the schedule_session_reminders function to prevent past reminders
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param UUID)
RETURNS VOID
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
  
  -- Get organization timezone (default to Europe/Istanbul if not set)
  SELECT COALESCE(os.timezone, 'Europe/Istanbul') INTO org_timezone
  FROM organization_settings os
  WHERE os.organization_id = session_record.organization_id;
  
  -- Convert session date + time from organization timezone to UTC
  session_datetime_utc := (session_record.session_date || ' ' || session_record.session_time)::timestamp AT TIME ZONE org_timezone AT TIME ZONE 'UTC';
  
  RAISE LOG 'Session datetime in UTC: %, org timezone: %', session_datetime_utc, org_timezone;
  
  -- Find active session_reminder workflows
  FOR workflow_record IN
    SELECT w.id, w.name
    FROM workflows w
    WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
  LOOP
    -- Calculate 1 day before reminder (at same time)
    reminder_datetime_utc := session_datetime_utc - INTERVAL '1 day';
    
    -- Only schedule if reminder is in the future
    IF reminder_datetime_utc > NOW() THEN
      -- Use ON CONFLICT to prevent duplicates
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
        '1_day',
        reminder_datetime_utc,
        'pending'
      )
      ON CONFLICT (session_id, workflow_id, reminder_type) DO UPDATE SET
        scheduled_for = EXCLUDED.scheduled_for,
        status = 'pending',
        updated_at = NOW();
      
      RAISE LOG 'Scheduled 1_day reminder for workflow % at %', workflow_record.name, reminder_datetime_utc;
    ELSE
      RAISE LOG 'Skipping past reminder for workflow % (would be at %)', workflow_record.name, reminder_datetime_utc;
    END IF;
  END LOOP;
  
END;
$$;