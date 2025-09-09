-- Fix foreign key relationships for scheduled_session_reminders table
ALTER TABLE scheduled_session_reminders 
ADD CONSTRAINT fk_scheduled_session_reminders_session_id 
FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

ALTER TABLE scheduled_session_reminders 
ADD CONSTRAINT fk_scheduled_session_reminders_workflow_id 
FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE;

-- Create function to schedule session reminders
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
  -- Get session details
  SELECT s.*, l.organization_id INTO session_record
  FROM sessions s
  JOIN leads l ON s.lead_id = l.id
  WHERE s.id = session_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;
  
  org_id := session_record.organization_id;
  
  -- Find active session reminder workflows for this organization
  FOR workflow_record IN 
    SELECT w.id, w.trigger_conditions
    FROM workflows w
    WHERE w.organization_id = org_id
    AND w.is_active = true
    AND w.trigger_type = 'session_reminder'
  LOOP
    -- Calculate reminder times based on workflow trigger conditions
    -- Default to 1 day before if no specific time is configured
    reminder_datetime := (session_record.session_date + session_record.session_time::interval) - interval '1 day';
    
    -- Check if trigger_conditions has specific reminder timing
    IF workflow_record.trigger_conditions ? 'reminder_days' THEN
      reminder_datetime := (session_record.session_date + session_record.session_time::interval) - 
                          (COALESCE((workflow_record.trigger_conditions->>'reminder_days')::integer, 1) || ' days')::interval;
    END IF;
    
    -- Only schedule future reminders
    IF reminder_datetime > now() THEN
      INSERT INTO scheduled_session_reminders (
        organization_id,
        session_id,
        workflow_id,
        scheduled_for,
        reminder_type,
        status
      ) VALUES (
        org_id,
        session_id_param,
        workflow_record.id,
        reminder_datetime,
        COALESCE(workflow_record.trigger_conditions->>'reminder_type', '1_day_before'),
        'pending'
      );
    END IF;
  END LOOP;
END;
$$;

-- Create function to cleanup old session reminders
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
  DELETE FROM scheduled_session_reminders 
  WHERE created_at < (now() - interval '7 days')
  AND status IN ('sent', 'failed', 'cancelled');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;