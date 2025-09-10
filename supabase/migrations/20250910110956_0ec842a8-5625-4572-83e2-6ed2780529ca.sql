-- Fix the reminder_type constraint and schedule reminders for existing sessions
-- First, drop the constraint if it exists and update the column
DO $$
BEGIN
  -- Try to drop the constraint if it exists
  BEGIN
    ALTER TABLE public.scheduled_session_reminders DROP CONSTRAINT IF EXISTS scheduled_session_reminders_reminder_type_check;
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignore error if constraint doesn't exist
      NULL;
  END;
  
  -- Modify the reminder_type column to allow longer values
  ALTER TABLE public.scheduled_session_reminders 
  ALTER COLUMN reminder_type TYPE varchar(100);
END $$;

-- Now schedule reminders for all existing sessions that don't have reminders yet
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error scheduling session reminders: %', SQLERRM;
END $$;