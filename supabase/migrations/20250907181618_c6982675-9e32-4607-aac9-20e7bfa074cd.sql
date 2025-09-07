-- Create a simple cron job that runs every minute to check for daily summaries
-- First enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing cron job for daily notifications
SELECT cron.unschedule('daily-notification-checker') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-notification-checker'
);

-- Create new cron job that runs every minute
SELECT cron.schedule(
  'daily-notification-checker',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/simple-daily-notifications',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
        body := '{"action": "process"}'::jsonb
    ) as request_id;
  $$
);