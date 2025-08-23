-- Add location field to sessions table
ALTER TABLE public.sessions 
ADD COLUMN location TEXT;