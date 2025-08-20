-- Add new notification types and weekly recap functionality

-- First, add new notification settings to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS notification_weekly_recap_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_weekly_recap_send_at text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS notification_project_milestone_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_lead_conversion_enabled boolean DEFAULT false;

-- Add new notification settings to organization_settings
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS notification_weekly_recap_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_weekly_recap_send_at text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS notification_project_milestone_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_lead_conversion_enabled boolean DEFAULT false;