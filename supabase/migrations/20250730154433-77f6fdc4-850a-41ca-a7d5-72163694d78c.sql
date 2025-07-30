-- Add completed column to activities table
ALTER TABLE public.activities 
ADD COLUMN completed BOOLEAN DEFAULT false;

-- Add an index on the completed column for better query performance
CREATE INDEX idx_activities_completed ON public.activities(completed);

-- Update existing activities to have completed = false by default
UPDATE public.activities 
SET completed = false 
WHERE completed IS NULL;