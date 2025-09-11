-- Clear all existing scheduled session reminders to start fresh
DELETE FROM scheduled_session_reminders;

-- Add function to clean up conflicting reminders (already exists but let's ensure it's available)
CREATE OR REPLACE FUNCTION public.cleanup_old_session_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned_count integer := 0;
BEGIN
  -- Delete old completed/failed/cancelled reminders (older than 7 days)
  DELETE FROM scheduled_session_reminders 
  WHERE status IN ('sent', 'failed', 'cancelled')
  AND processed_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Delete duplicate pending reminders (keep the earliest one for each session+workflow combo)
  DELETE FROM scheduled_session_reminders sr1
  WHERE sr1.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM scheduled_session_reminders sr2
      WHERE sr2.session_id = sr1.session_id
        AND sr2.workflow_id = sr1.workflow_id  
        AND sr2.status = 'pending'
        AND sr2.created_at < sr1.created_at
    );
    
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$;