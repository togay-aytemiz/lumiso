-- Update leads table to use text for status instead of enum
-- First, let's add a new temporary column
ALTER TABLE public.leads ADD COLUMN status_temp text;

-- Copy existing status values to the new column
UPDATE public.leads SET status_temp = status::text;

-- Drop the old enum column
ALTER TABLE public.leads DROP COLUMN status;

-- Rename the temp column to status
ALTER TABLE public.leads RENAME COLUMN status_temp TO status;

-- Set default value to 'New' for new leads
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'New';

-- Make sure the column is not null
ALTER TABLE public.leads ALTER COLUMN status SET NOT NULL;