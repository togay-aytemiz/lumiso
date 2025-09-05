-- Create proper cron jobs for daily notifications and workflow processing
-- First try to unschedule existing jobs (ignore errors if they don't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-notifications-7am');
EXCEPTION WHEN others THEN
  NULL; -- Ignore if job doesn't exist
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('notification-processor-every-minute');
EXCEPTION WHEN others THEN
  NULL; -- Ignore if job doesn't exist
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('workflow-processor-every-minute');
EXCEPTION WHEN others THEN
  NULL; -- Ignore if job doesn't exist
END $$;

-- Schedule daily notifications to run at 7 AM daily
SELECT cron.schedule(
  'daily-notifications-7am',
  '0 7 * * *',
  $$
  select net.http_post(
    url:='https://rifdykpdubrowzbylffe.supabase.co/functions/v1/schedule-daily-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Schedule notification processor to run every 2 minutes
SELECT cron.schedule(
  'notification-processor-every-2-minutes',
  '*/2 * * * *',
  $$
  select net.http_post(
    url:='https://rifdykpdubrowzbylffe.supabase.co/functions/v1/notification-processor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
    body:'{"action": "process-pending"}'::jsonb
  ) as request_id;
  $$
);