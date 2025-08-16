-- Add notification settings columns to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS notification_overdue_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_delivery_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_delivery_reminder_send_at text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS notification_session_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_session_reminder_send_at text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS notification_daily_summary_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_daily_summary_send_at text DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS notification_task_nudge_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_integration_failure_alert_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_team_invite_accepted_alert_enabled boolean DEFAULT false;