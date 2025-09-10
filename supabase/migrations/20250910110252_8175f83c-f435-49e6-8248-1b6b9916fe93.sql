-- Update the schedule_session_reminders function with correct conflict resolution
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
  org_timezone TEXT;
  workflow_record RECORD;
  reminder_datetime TIMESTAMP WITH TIME ZONE;
  current_utc TIMESTAMP WITH TIME ZONE := NOW();
  session_datetime_utc TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get session details
  SELECT s.*
  INTO session_record
  FROM sessions s
  WHERE s.id = session_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;

  -- Get organization timezone, default to UTC if not set
  SELECT COALESCE(os.timezone, 'UTC')
  INTO org_timezone
  FROM organization_settings os
  WHERE os.organization_id = session_record.organization_id;

  -- Convert session datetime to UTC for calculations
  -- Session date + time should be interpreted in organization timezone
  session_datetime_utc := (session_record.session_date + session_record.session_time) AT TIME ZONE COALESCE(org_timezone, 'UTC') AT TIME ZONE 'UTC';

  RAISE LOG 'Session datetime in UTC: %, org timezone: %', session_datetime_utc, COALESCE(org_timezone, 'UTC');

  -- Find active session reminder workflows for this organization
  FOR workflow_record IN
    SELECT w.id, w.name, w.trigger_conditions
    FROM workflows w
    WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
  LOOP
    -- Extract delay from trigger conditions (in minutes)
    DECLARE
      delay_minutes INTEGER;
      workflow_name TEXT;
    BEGIN
      delay_minutes := COALESCE((workflow_record.trigger_conditions->>'delay_minutes')::INTEGER, 1440); -- Default 1 day
      workflow_name := workflow_record.name;
      
      -- Calculate when reminder should be sent (session time minus delay)
      reminder_datetime := session_datetime_utc - (delay_minutes || ' minutes')::INTERVAL;
      
      -- If reminder time is in the past but not too old (less than 2 hours ago), schedule immediately
      IF reminder_datetime < current_utc AND (current_utc - reminder_datetime) < INTERVAL '2 hours' THEN
        reminder_datetime := current_utc + INTERVAL '30 seconds'; -- Schedule for immediate processing
        RAISE LOG 'Scheduling immediate reminder for workflow % (original time: %, scheduled for: %)', workflow_name, session_datetime_utc - (delay_minutes || ' minutes')::INTERVAL, reminder_datetime;
      END IF;
      
      -- Only schedule if reminder time is in the future or recently missed
      IF reminder_datetime >= current_utc OR (current_utc - (session_datetime_utc - (delay_minutes || ' minutes')::INTERVAL)) < INTERVAL '2 hours' THEN
        -- Insert or update the scheduled reminder using the correct unique constraint
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
          workflow_name,
          reminder_datetime,
          'pending'
        )
        ON CONFLICT (session_id, workflow_id, reminder_type) 
        DO UPDATE SET
          scheduled_for = EXCLUDED.scheduled_for,
          status = 'pending';
          
        RAISE LOG 'Scheduled reminder: % for session % at %', workflow_name, session_id_param, reminder_datetime;
      ELSE
        RAISE LOG 'Skipping past reminder: % for session % (would have been at %)', workflow_name, session_id_param, reminder_datetime;
      END IF;
    END;
  END LOOP;
END;
$$;