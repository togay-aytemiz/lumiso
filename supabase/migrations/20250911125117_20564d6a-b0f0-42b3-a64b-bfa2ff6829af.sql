-- Clear all existing scheduled session reminders to start fresh with fixed logic
DELETE FROM scheduled_session_reminders;

-- Reschedule all reminders using the fixed workflow executor logic
-- This will ensure only the correct reminders are scheduled
DO $$
DECLARE
  session_record RECORD;
  reminder_count INTEGER := 0;
BEGIN
  FOR session_record IN 
    SELECT id FROM sessions 
    WHERE session_date >= CURRENT_DATE 
    ORDER BY session_date ASC, session_time ASC
  LOOP
    PERFORM schedule_session_reminders(session_record.id);
    reminder_count := reminder_count + 1;
    
    -- Log progress every 10 sessions
    IF reminder_count % 10 = 0 THEN
      RAISE NOTICE 'Rescheduled reminders for % sessions', reminder_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed rescheduling reminders for % sessions total', reminder_count;
END
$$;