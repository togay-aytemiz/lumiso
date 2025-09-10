-- Fix session reminder scheduling by reading delay_minutes from correct column
-- and update 1-day reminder workflow to have proper delay

-- 1. Fix the schedule_session_reminders function to read delay_minutes from workflow_steps.delay_minutes
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
  workflow_record RECORD;
  step_record RECORD;
  org_timezone TEXT;
  session_datetime TIMESTAMPTZ;
  reminder_time TIMESTAMPTZ;
  same_day_morning_time TIMESTAMPTZ;
BEGIN
  -- Get session details
  SELECT s.*
  INTO session_record
  FROM sessions s
  WHERE s.id = session_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;
  
  -- Get organization timezone separately
  SELECT o.timezone
  INTO org_timezone
  FROM organization_settings o
  WHERE o.organization_id = session_record.organization_id;
  
  -- Default timezone to UTC if not set
  org_timezone := COALESCE(org_timezone, 'UTC');
  
  -- Convert session date and time to full timestamp in organization timezone
  session_datetime := (session_record.session_date || ' ' || session_record.session_time)::timestamp AT TIME ZONE org_timezone;
  
  -- Find active session reminder workflows for this organization
  FOR workflow_record IN
    SELECT w.*
    FROM workflows w
    WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
  LOOP
    -- Get workflow steps to find delay_minutes
    FOR step_record IN
      SELECT ws.*
      FROM workflow_steps ws
      WHERE ws.workflow_id = workflow_record.id
      AND ws.is_active = true
      ORDER BY ws.step_order
      LIMIT 1  -- Take first active step
    LOOP
      -- Read delay_minutes from workflow_steps.delay_minutes column (NOT from action_config)
      DECLARE
        delay_minutes INTEGER;
        reminder_label TEXT;
      BEGIN
        delay_minutes := COALESCE(step_record.delay_minutes, 0);
        
        -- Special handling for same day morning (8AM) reminders
        IF delay_minutes = 480 THEN
          -- Calculate 8AM on the session date in organization timezone
          same_day_morning_time := (session_record.session_date || ' 08:00:00')::timestamp AT TIME ZONE org_timezone;
          
          -- Only schedule if 8AM hasn't passed yet
          IF same_day_morning_time > NOW() THEN
            reminder_time := same_day_morning_time;
            reminder_label := 'Session reminder - Same day morning (8AM)';
            
            -- Insert reminder record
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
              reminder_label,
              reminder_time,
              'pending'
            )
            ON CONFLICT DO NOTHING;  -- Prevent duplicates
          END IF;
        ELSE
          -- Standard reminder calculation (subtract minutes from session time)
          reminder_time := session_datetime - (delay_minutes || ' minutes')::INTERVAL;
          
          -- Only schedule if reminder time is in the future
          IF reminder_time > NOW() THEN
            -- Determine reminder type label
            CASE delay_minutes
              WHEN 60 THEN reminder_label := 'Session reminder - 1 hour';
              WHEN 1440 THEN reminder_label := 'Session reminder - 1 day';
              WHEN 4320 THEN reminder_label := 'Session reminder - 3 days';
              WHEN 10080 THEN reminder_label := 'Session reminder - 1 week';
              ELSE reminder_label := 'Session reminder - ' || delay_minutes || ' minutes';
            END CASE;
            
            -- Insert reminder record
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
              reminder_label,
              reminder_time,
              'pending'
            )
            ON CONFLICT DO NOTHING;  -- Prevent duplicates
          END IF;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but continue processing
          RAISE LOG 'Error processing workflow step %: %', step_record.id, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- 2. Update the "Session reminder - 1 day" workflow step to have proper delay_minutes
UPDATE workflow_steps 
SET delay_minutes = 1440 
WHERE workflow_id IN (
  SELECT w.id FROM workflows w 
  WHERE w.name = 'Session reminder - 1 day' 
  AND w.trigger_type = 'session_reminder'
) 
AND delay_minutes = 0;

-- 3. Clean up any existing incorrect reminders for test sessions and re-schedule
-- First delete existing pending reminders for test sessions
DELETE FROM scheduled_session_reminders 
WHERE session_id IN (
  SELECT s.id FROM sessions s 
  JOIN leads l ON s.lead_id = l.id 
  WHERE l.name ILIKE '%Togay%Aytemis%'
) 
AND status = 'pending';

-- 4. Re-schedule reminders for the test sessions
DO $$
DECLARE
  test_session_id UUID;
BEGIN
  FOR test_session_id IN 
    SELECT s.id FROM sessions s 
    JOIN leads l ON s.lead_id = l.id 
    WHERE l.name ILIKE '%Togay%Aytemis%'
  LOOP
    PERFORM public.schedule_session_reminders(test_session_id);
  END LOOP;
END $$;