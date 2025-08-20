-- Add guided setup tracking fields to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN in_guided_setup boolean DEFAULT false,
ADD COLUMN guided_setup_skipped boolean DEFAULT false,
ADD COLUMN guidance_completed boolean DEFAULT false;