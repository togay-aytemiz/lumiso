-- Reschedule all existing future session reminders to get all three types
DO $$
DECLARE
  session_rec RECORD;
  reminder_count INTEGER;
BEGIN
  -- For each future session that doesn't have all three reminder types
  FOR session_rec IN 
    SELECT DISTINCT s.id, s.session_date, s.session_time
    FROM sessions s
    LEFT JOIN scheduled_session_reminders sr ON s.id = sr.session_id AND sr.status = 'pending'
    WHERE s.session_date >= CURRENT_DATE
    AND s.session_date > CURRENT_DATE + INTERVAL '1 day' -- Only sessions more than 1 day away
    GROUP BY s.id, s.session_date, s.session_time
    HAVING COUNT(DISTINCT sr.reminder_type) < 3 OR COUNT(sr.id) = 0
  LOOP
    -- Get current reminder count
    SELECT COUNT(*) INTO reminder_count
    FROM scheduled_session_reminders 
    WHERE session_id = session_rec.id AND status = 'pending';
    
    -- Log what we're doing
    RAISE NOTICE 'Rescheduling session % (date: %) - current reminders: %', 
      session_rec.id, session_rec.session_date, reminder_count;
    
    -- Call the fixed function to reschedule
    PERFORM public.schedule_session_reminders(session_rec.id);
  END LOOP;
  
  -- Log summary
  SELECT COUNT(*) INTO reminder_count
  FROM scheduled_session_reminders sr
  JOIN sessions s ON sr.session_id = s.id
  WHERE s.session_date >= CURRENT_DATE AND sr.status = 'pending';
  
  RAISE NOTICE 'Completed rescheduling. Total pending reminders now: %', reminder_count;
END $$;