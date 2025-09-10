-- Clean up incorrect reminders and debug/fix the function
DELETE FROM scheduled_session_reminders 
WHERE session_id IN ('7608f543-5d9c-44c3-ad69-97b3bf76b46f', 'ff71fd49-f50b-485f-a431-5653513b76e0')
AND reminder_type = 'Session reminder - 0 minutes';

-- Test one session to debug what's happening
DO $$
DECLARE
  test_session_id UUID := '7608f543-5d9c-44c3-ad69-97b3bf76b46f';
  session_record RECORD;
  workflow_record RECORD;
  step_record RECORD;
  debug_delay_minutes INTEGER;
BEGIN
  -- Test the function logic manually to see what's happening
  SELECT s.* INTO session_record FROM sessions s WHERE s.id = test_session_id;
  
  RAISE LOG 'Session found: % on % at %', session_record.id, session_record.session_date, session_record.session_time;
  
  -- Get workflows
  FOR workflow_record IN
    SELECT w.*
    FROM workflows w
    WHERE w.organization_id = session_record.organization_id
    AND w.trigger_type = 'session_reminder'
    AND w.is_active = true
  LOOP
    RAISE LOG 'Processing workflow: %', workflow_record.name;
    
    -- Get workflow steps
    FOR step_record IN
      SELECT ws.*
      FROM workflow_steps ws
      WHERE ws.workflow_id = workflow_record.id
      AND ws.is_active = true
      ORDER BY ws.step_order
      LIMIT 1
    LOOP
      debug_delay_minutes := COALESCE(step_record.delay_minutes, 0);
      RAISE LOG 'Workflow: %, Step delay_minutes: %', workflow_record.name, debug_delay_minutes;
    END LOOP;
  END LOOP;
END $$;

-- Now trigger the function again
SELECT public.schedule_session_reminders('7608f543-5d9c-44c3-ad69-97b3bf76b46f');