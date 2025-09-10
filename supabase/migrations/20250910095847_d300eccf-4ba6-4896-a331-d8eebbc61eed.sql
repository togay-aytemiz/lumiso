-- Add social_channels JSONB column to organization_settings table
ALTER TABLE public.organization_settings 
ADD COLUMN social_channels JSONB DEFAULT '{}'::jsonb;