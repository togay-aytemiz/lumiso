-- Fix the timing buffer logic in the session reminders processor
-- The buffer should allow processing slightly LATE reminders, not early ones

-- First, let's create a function to get the exact session data for debugging
CREATE OR REPLACE FUNCTION public.debug_get_session_for_reminder(reminder_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'reminder_id', sr.id,
    'session_id', sr.session_id, 
    'reminder_type', sr.reminder_type,
    'scheduled_for', sr.scheduled_for,
    'session_date', s.session_date,
    'session_time', s.session_time,
    'session_location', s.location,
    'lead_name', l.name,
    'lead_email', l.email,
    'organization_id', sr.organization_id
  ) INTO result
  FROM scheduled_session_reminders sr
  JOIN sessions s ON sr.session_id = s.id
  JOIN leads l ON s.lead_id = l.id
  WHERE sr.id = reminder_id_param;
  
  RETURN result;
END;
$$;

-- Function to prevent duplicate reminder processing
CREATE OR REPLACE FUNCTION public.prevent_duplicate_reminder_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If trying to update to 'sent' but already processed recently, skip
  IF NEW.status = 'sent' AND OLD.status = 'pending' THEN
    -- Check if there's another reminder of the same type for the same session processed recently
    IF EXISTS (
      SELECT 1 FROM scheduled_session_reminders sr
      WHERE sr.session_id = NEW.session_id
        AND sr.reminder_type = NEW.reminder_type
        AND sr.status = 'sent'
        AND sr.processed_at > (NOW() - INTERVAL '10 minutes')
        AND sr.id != NEW.id
    ) THEN
      RAISE NOTICE 'Duplicate reminder processing detected for session % type %, skipping', NEW.session_id, NEW.reminder_type;
      RETURN NULL; -- Prevent the update
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the trigger to prevent duplicates
DROP TRIGGER IF EXISTS prevent_duplicate_reminders ON scheduled_session_reminders;
CREATE TRIGGER prevent_duplicate_reminders
  BEFORE UPDATE ON scheduled_session_reminders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_reminder_processing();

-- Create a function to cleanup conflicting reminders
CREATE OR REPLACE FUNCTION public.cleanup_conflicting_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned_count integer := 0;
BEGIN
  -- Delete duplicate pending reminders (keep the earliest one for each session+type combo)
  DELETE FROM scheduled_session_reminders sr1
  WHERE sr1.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM scheduled_session_reminders sr2
      WHERE sr2.session_id = sr1.session_id
        AND sr2.reminder_type = sr1.reminder_type  
        AND sr2.status = 'pending'
        AND sr2.created_at < sr1.created_at
    );
    
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$;

-- Clean up existing conflicts
SELECT cleanup_conflicting_reminders();