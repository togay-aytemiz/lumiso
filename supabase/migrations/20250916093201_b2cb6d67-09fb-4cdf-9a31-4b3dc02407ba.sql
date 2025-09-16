-- Remove Google Calendar integration completely

-- Drop the google_calendar_tokens table
DROP TABLE IF EXISTS public.google_calendar_tokens;

-- Remove google_event_id columns from sessions and activities tables
ALTER TABLE public.sessions DROP COLUMN IF EXISTS google_event_id;
ALTER TABLE public.activities DROP COLUMN IF EXISTS google_event_id;