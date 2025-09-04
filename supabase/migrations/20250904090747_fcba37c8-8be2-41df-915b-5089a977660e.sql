-- Create proper cron jobs for daily notifications and workflow processing
-- Remove existing cron jobs first
SELECT cron.unschedule('daily-notifications-7am');
SELECT cron.unschedule('notification-processor-every-minute');
SELECT cron.unschedule('workflow-processor-every-minute');

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

-- Create a test session to trigger workflow
INSERT INTO sessions (
  user_id, 
  organization_id, 
  title, 
  scheduled_date, 
  status_id,
  project_id
) VALUES (
  'ac32273e-af95-4de9-abed-ce96e6f68139',
  '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45',
  'Test Session for Workflow',
  now() + interval '1 day',
  (SELECT id FROM session_statuses WHERE organization_id = '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45' AND name = 'Planned' LIMIT 1),
  (SELECT id FROM projects WHERE organization_id = '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45' LIMIT 1)
);