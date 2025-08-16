-- Fix working hours to ensure all users have proper default values with times displayed
UPDATE public.working_hours 
SET start_time = '09:00', end_time = '17:00'
WHERE start_time IS NULL OR end_time IS NULL;

-- Ensure the working hours are properly visible by setting explicit values
UPDATE public.working_hours 
SET start_time = '09:00', end_time = '17:00'
WHERE start_time = '' OR end_time = '' OR start_time IS NULL OR end_time IS NULL;