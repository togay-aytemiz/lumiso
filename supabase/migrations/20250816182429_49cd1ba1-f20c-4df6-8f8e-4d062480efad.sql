-- Fix working hours to ensure all users have proper default values with times displayed
UPDATE public.working_hours 
SET start_time = '09:00'::time, end_time = '17:00'::time
WHERE start_time IS NULL OR end_time IS NULL;