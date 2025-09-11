-- Fix session reminder system issues
-- 1. Clean up duplicate and invalid reminders
-- 2. Fix timing precision in reminders
-- 3. Improve the schedule_session_reminders function

-- First, remove all "0 minutes" reminders as they are invalid
DELETE FROM scheduled_session_reminders 
WHERE reminder_type LIKE '%0 minutes%' OR reminder_type LIKE '%0 min%';

-- Remove duplicate pending reminders (keep only the earliest one for each session+type combo)
DELETE FROM scheduled_session_reminders sr1
WHERE sr1.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM scheduled_session_reminders sr2
    WHERE sr2.session_id = sr1.session_id
      AND sr2.reminder_type = sr1.reminder_type  
      AND sr2.status = 'pending'
      AND sr2.created_at < sr1.created_at
  );

-- Update the schedule_session_reminders function to prevent duplicates and fix timing
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
  session_datetime TIMESTAMP WITH TIME ZONE;
  reminder_datetime TIMESTAMP WITH TIME ZONE;
  org_timezone TEXT;
  existing_count INTEGER;
BEGIN
  -- Get session details with timezone
  SELECT s.*, os.timezone 
  INTO session_record, org_timezone
  FROM sessions s
  JOIN organization_settings os ON s.organization_id = os.organization_id
  WHERE s.id = session_id_param;

  IF session_record IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;

  -- Convert session date/time to timestamp with timezone
  session_datetime := (session_record.session_date || ' ' || session_record.session_time)::timestamp;
  session_datetime := session_datetime AT TIME ZONE COALESCE(org_timezone, 'UTC');

  -- Only schedule if session is in the future
  IF session_datetime <= NOW() THEN
    RAISE NOTICE 'Session % is in the past or too close, not scheduling reminders', session_id_param;
    RETURN;
  END IF;

  -- Clean up any existing pending reminders for this session to prevent duplicates
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';

  -- Schedule 1-day reminder (exactly 24 hours before)
  reminder_datetime := session_datetime - INTERVAL '1 day';
  IF reminder_datetime > NOW() THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id, 
      'Session reminder - 1 day', 
      reminder_datetime,
      'pending'
    );
  END IF;

  -- Schedule 3-day reminder (exactly 72 hours before)
  reminder_datetime := session_datetime - INTERVAL '3 days';
  IF reminder_datetime > NOW() THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id, 
      'Session reminder - 3 days', 
      reminder_datetime,
      'pending'
    );
  END IF;

  -- Schedule 1-week reminder (exactly 7 days before)
  reminder_datetime := session_datetime - INTERVAL '1 week';
  IF reminder_datetime > NOW() THEN
    INSERT INTO scheduled_session_reminders (
      session_id, organization_id, reminder_type, scheduled_for, status
    ) VALUES (
      session_id_param, 
      session_record.organization_id, 
      'Session reminder - 1 week', 
      reminder_datetime,
      'pending'
    );
  END IF;

  -- Log what was scheduled
  SELECT COUNT(*) INTO existing_count
  FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';
  
  RAISE NOTICE 'Scheduled % reminders for session % (datetime: %)', 
    existing_count, session_id_param, session_datetime;
END;
$$;