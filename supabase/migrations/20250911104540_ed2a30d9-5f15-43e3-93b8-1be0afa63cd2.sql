-- Drop and recreate the schedule_session_reminders function with proper cascading logic
DROP FUNCTION IF EXISTS public.schedule_session_reminders(uuid);

CREATE OR REPLACE FUNCTION public.schedule_session_reminders(session_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  days_until_session INTEGER;
  reminder_count INTEGER := 0;
  workflow_1_week RECORD;
  workflow_3_day RECORD;
  workflow_1_day RECORD;
  scheduled_reminders jsonb := '[]'::jsonb;
BEGIN
  -- Get session details with lead info
  SELECT 
    s.id, s.session_date, s.session_time, s.organization_id, s.lead_id,
    l.name as lead_name, l.email as lead_email
  INTO session_record
  FROM sessions s
  JOIN leads l ON s.lead_id = l.id
  WHERE s.id = session_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', session_id_param;
  END IF;
  
  -- Calculate days until session
  days_until_session := session_record.session_date - CURRENT_DATE;
  
  -- Find active workflows for each reminder type
  SELECT w.id, w.name INTO workflow_1_week
  FROM workflows w
  WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
    AND (w.name ILIKE '%1 week%' OR w.name ILIKE '%7 day%')
  ORDER BY w.created_at DESC
  LIMIT 1;
  
  SELECT w.id, w.name INTO workflow_3_day
  FROM workflows w
  WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
    AND (w.name ILIKE '%3 day%')
  ORDER BY w.created_at DESC
  LIMIT 1;
  
  SELECT w.id, w.name INTO workflow_1_day
  FROM workflows w
  WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
    AND (w.name ILIKE '%1 day%' AND w.name NOT ILIKE '%3 day%')
  ORDER BY w.created_at DESC
  LIMIT 1;
  
  -- Clean up any existing pending reminders for this session
  DELETE FROM scheduled_session_reminders 
  WHERE session_id = session_id_param AND status = 'pending';
  
  -- Apply cascading logic based on days until session
  IF days_until_session >= 7 AND workflow_1_week.id IS NOT NULL THEN
    -- Schedule 1-week reminder
    INSERT INTO scheduled_session_reminders (
      organization_id, session_id, workflow_id, reminder_type, 
      scheduled_for, status
    ) VALUES (
      session_record.organization_id, session_id_param, workflow_1_week.id, 
      '1_week', 
      (session_record.session_date - INTERVAL '7 days') + session_record.session_time,
      'pending'
    );
    reminder_count := reminder_count + 1;
    scheduled_reminders := scheduled_reminders || jsonb_build_object(
      'type', '1_week', 
      'workflow', workflow_1_week.name,
      'scheduled_for', (session_record.session_date - INTERVAL '7 days') + session_record.session_time
    );
  END IF;
  
  IF days_until_session >= 3 AND workflow_3_day.id IS NOT NULL THEN
    -- Schedule 3-day reminder
    INSERT INTO scheduled_session_reminders (
      organization_id, session_id, workflow_id, reminder_type,
      scheduled_for, status
    ) VALUES (
      session_record.organization_id, session_id_param, workflow_3_day.id,
      '3_day',
      (session_record.session_date - INTERVAL '3 days') + session_record.session_time,
      'pending'
    );
    reminder_count := reminder_count + 1;
    scheduled_reminders := scheduled_reminders || jsonb_build_object(
      'type', '3_day',
      'workflow', workflow_3_day.name, 
      'scheduled_for', (session_record.session_date - INTERVAL '3 days') + session_record.session_time
    );
  END IF;
  
  IF days_until_session >= 1 AND workflow_1_day.id IS NOT NULL THEN
    -- Schedule 1-day reminder
    INSERT INTO scheduled_session_reminders (
      organization_id, session_id, workflow_id, reminder_type,
      scheduled_for, status
    ) VALUES (
      session_record.organization_id, session_id_param, workflow_1_day.id,
      '1_day',
      (session_record.session_date - INTERVAL '1 day') + session_record.session_time,
      'pending'
    );
    reminder_count := reminder_count + 1;
    scheduled_reminders := scheduled_reminders || jsonb_build_object(
      'type', '1_day',
      'workflow', workflow_1_day.name,
      'scheduled_for', (session_record.session_date - INTERVAL '1 day') + session_record.session_time
    );
  END IF;
  
  -- Return summary
  RETURN jsonb_build_object(
    'session_id', session_id_param,
    'days_until_session', days_until_session,
    'reminders_scheduled', reminder_count,
    'scheduled_reminders', scheduled_reminders,
    'available_workflows', jsonb_build_object(
      '1_week', CASE WHEN workflow_1_week.id IS NOT NULL THEN workflow_1_week.name ELSE null END,
      '3_day', CASE WHEN workflow_3_day.id IS NOT NULL THEN workflow_3_day.name ELSE null END,
      '1_day', CASE WHEN workflow_1_day.id IS NOT NULL THEN workflow_1_day.name ELSE null END
    )
  );
END;
$function$;