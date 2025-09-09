-- Fix duplicate foreign key constraints and missing database function

-- Remove duplicate foreign key constraints that are causing PostgREST ambiguity
ALTER TABLE public.scheduled_session_reminders 
DROP CONSTRAINT IF EXISTS fk_scheduled_session_reminders_session;

ALTER TABLE public.scheduled_session_reminders 
DROP CONSTRAINT IF EXISTS fk_scheduled_session_reminders_workflow;

-- Keep only the _id versions for clarity
-- (fk_scheduled_session_reminders_session_id and fk_scheduled_session_reminders_workflow_id should remain)

-- Recreate the schedule_session_reminders function properly
CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
  workflow_record RECORD;
  reminder_datetime TIMESTAMP WITH TIME ZONE;
  org_id UUID;
BEGIN
  -- Get session details with organization_id
  SELECT s.*, s.organization_id INTO session_record
  FROM public.sessions s
  WHERE s.id = session_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;
  
  org_id := session_record.organization_id;
  
  -- Log the scheduling attempt
  RAISE NOTICE 'Scheduling reminders for session % in organization %', session_id_param, org_id;
  
  -- Get all session reminder workflows for this organization
  FOR workflow_record IN 
    SELECT w.* 
    FROM public.workflows w
    WHERE w.organization_id = org_id
      AND w.trigger_type = 'session_reminder'
      AND w.is_active = true
  LOOP
    -- Schedule 24-hour reminder (email)
    reminder_datetime := (session_record.session_date + session_record.session_time - INTERVAL '24 hours')::timestamp with time zone;
    
    IF reminder_datetime > NOW() THEN
      INSERT INTO public.scheduled_session_reminders (
        organization_id,
        session_id,
        workflow_id,
        reminder_type,
        scheduled_for,
        status
      ) VALUES (
        org_id,
        session_id_param,
        workflow_record.id,
        '24_hour',
        reminder_datetime,
        'pending'
      );
      
      RAISE NOTICE 'Scheduled 24-hour reminder for %', reminder_datetime;
    END IF;
    
    -- Schedule 2-hour reminder (SMS/WhatsApp)
    reminder_datetime := (session_record.session_date + session_record.session_time - INTERVAL '2 hours')::timestamp with time zone;
    
    IF reminder_datetime > NOW() THEN
      INSERT INTO public.scheduled_session_reminders (
        organization_id,
        session_id,
        workflow_id,
        reminder_type,
        scheduled_for,
        status
      ) VALUES (
        org_id,
        session_id_param,
        workflow_record.id,
        '2_hour',
        reminder_datetime,
        'pending'
      );
      
      RAISE NOTICE 'Scheduled 2-hour reminder for %', reminder_datetime;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed scheduling reminders for session %', session_id_param;
END;
$$;

-- Create cleanup function for old reminders
CREATE OR REPLACE FUNCTION public.cleanup_old_session_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete reminders older than 7 days that are processed or failed
  DELETE FROM public.scheduled_session_reminders
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND status IN ('sent', 'failed', 'cancelled');
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;