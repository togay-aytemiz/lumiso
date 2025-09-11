-- Add cleanup function for old session reminders
CREATE OR REPLACE FUNCTION public.cleanup_old_session_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Clean up reminders older than 7 days that have been processed
  DELETE FROM scheduled_session_reminders 
  WHERE created_at < (NOW() - INTERVAL '7 days')
  AND status IN ('sent', 'failed', 'cancelled');
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Also clean up any stuck 'sent' reminders without processed_at timestamp
  UPDATE scheduled_session_reminders 
  SET processed_at = COALESCE(processed_at, created_at)
  WHERE status = 'sent' AND processed_at IS NULL;
  
  RETURN cleaned_count;
END;
$$;

-- Add enhanced duplicate prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_duplicate_session_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if there's already a pending reminder of the same type for the same session
  IF EXISTS (
    SELECT 1 FROM scheduled_session_reminders sr
    WHERE sr.session_id = NEW.session_id
      AND sr.reminder_type = NEW.reminder_type
      AND sr.status = 'pending'
      AND sr.id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Duplicate reminder prevented: % already exists for session %', 
      NEW.reminder_type, NEW.session_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the trigger
DROP TRIGGER IF EXISTS prevent_duplicate_session_reminders_trigger ON scheduled_session_reminders;
CREATE TRIGGER prevent_duplicate_session_reminders_trigger
  BEFORE INSERT ON scheduled_session_reminders
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_session_reminders();