-- Fix session status type mismatch issue
-- Convert session status from enum to text for better compatibility

-- First, add a new text column for status
ALTER TABLE public.sessions ADD COLUMN status_new text;

-- Copy existing enum values to the new text column
UPDATE public.sessions SET status_new = status::text;

-- Drop the old enum column
ALTER TABLE public.sessions DROP COLUMN status;

-- Rename the new column to status
ALTER TABLE public.sessions RENAME COLUMN status_new TO status;

-- Set default value and not null constraint
ALTER TABLE public.sessions ALTER COLUMN status SET DEFAULT 'planned';
ALTER TABLE public.sessions ALTER COLUMN status SET NOT NULL;

-- Add a check constraint to ensure valid status values
ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check 
CHECK (status IN ('planned', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'in_progress'));

-- Drop the session_status enum type if it exists
DROP TYPE IF EXISTS session_status CASCADE;