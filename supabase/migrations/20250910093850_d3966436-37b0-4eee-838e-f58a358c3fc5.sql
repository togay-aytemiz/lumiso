-- Fix short-notice reminder scheduling
-- Allow reminders that are close to current time or in the past

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
  final_reminder_time TIMESTAMPTZ;
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
    
    -- Determine final reminder time:
    -- If reminder time is in the past or very close (within 2 minutes), schedule for immediate sending
    IF reminder_datetime_utc <= NOW() + INTERVAL '2 minutes' THEN
      final_reminder_time := NOW() + INTERVAL '30 seconds';
      RAISE LOG 'Scheduling immediate reminder for workflow % (original time: %, scheduled for: %)', 
                workflow_record.name, reminder_datetime_utc, final_reminder_time;
    ELSE
      final_reminder_time := reminder_datetime_utc;
      RAISE LOG 'Scheduling future reminder for workflow % at %', workflow_record.name, final_reminder_time;
    END IF;
    
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
      final_reminder_time,
      'pending'
    )
    ON CONFLICT (session_id, workflow_id, reminder_type) DO UPDATE SET
      scheduled_for = EXCLUDED.scheduled_for,
      status = 'pending',
      updated_at = NOW();
    
  END LOOP;
  
END;
$$;