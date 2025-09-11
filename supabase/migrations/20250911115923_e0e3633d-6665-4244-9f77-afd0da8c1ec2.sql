-- Clear all existing scheduled session reminders to start fresh
DELETE FROM scheduled_session_reminders;

-- Now reschedule reminders for all existing sessions to test the new logic
DO $$
DECLARE
  session_record RECORD;
BEGIN
  FOR session_record IN 
    SELECT id FROM sessions 
    WHERE session_date >= CURRENT_DATE 
    ORDER BY session_date ASC, session_time ASC
  LOOP
    PERFORM schedule_session_reminders(session_record.id);
  END LOOP;
END
$$;