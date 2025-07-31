-- Add Google Calendar event ID columns to sessions and activities tables
ALTER TABLE public.sessions 
ADD COLUMN google_event_id TEXT;

ALTER TABLE public.activities 
ADD COLUMN google_event_id TEXT;

-- Add index for faster lookups
CREATE INDEX idx_sessions_google_event_id ON public.sessions(google_event_id) WHERE google_event_id IS NOT NULL;
CREATE INDEX idx_activities_google_event_id ON public.activities(google_event_id) WHERE google_event_id IS NOT NULL;