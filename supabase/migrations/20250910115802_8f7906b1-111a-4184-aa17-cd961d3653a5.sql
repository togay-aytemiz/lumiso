-- Fix same day morning 8AM reminder logic with proper timezone handling
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
  SELECT s.*, o.timezone
  INTO session_record, org_timezone
  FROM sessions s
  LEFT JOIN organization_settings o ON s.organization_id = o.organization_id
  WHERE s.id = session_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;
  
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
      -- Extract delay_minutes from action_config
      DECLARE
        delay_minutes INTEGER;
      BEGIN
        delay_minutes := COALESCE((step_record.action_config->>'delay_minutes')::INTEGER, 0);
        
        -- Special handling for same day morning (8AM) reminders
        IF delay_minutes = 480 THEN
          -- Calculate 8AM on the session date in organization timezone
          same_day_morning_time := (session_record.session_date || ' 08:00:00')::timestamp AT TIME ZONE org_timezone;
          
          -- Only schedule if 8AM hasn't passed yet
          IF same_day_morning_time > NOW() THEN
            reminder_time := same_day_morning_time;
            
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
              'Session reminder - Same day morning (8AM)',
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
            DECLARE
              reminder_label TEXT;
            BEGIN
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
            END;
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