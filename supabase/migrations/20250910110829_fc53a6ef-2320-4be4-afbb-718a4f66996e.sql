-- Schedule reminders for all existing sessions that don't have reminders yet
DO $$
DECLARE
  session_record RECORD;
BEGIN
  -- Process all sessions that don't have scheduled reminders
  FOR session_record IN
    SELECT s.id
    FROM sessions s
    LEFT JOIN scheduled_session_reminders ssr ON s.id = ssr.session_id
    WHERE ssr.id IS NULL
    AND s.session_date >= CURRENT_DATE - INTERVAL '7 days' -- Only recent sessions
  LOOP
    -- Call the scheduling function for each session
    PERFORM public.schedule_session_reminders(session_record.id);
  END LOOP;
END $$;