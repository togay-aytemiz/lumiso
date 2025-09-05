-- Clean up old cron jobs and ensure only the correct ones are running
DO $$
BEGIN
  PERFORM cron.unschedule('daily-notifications-processor');
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Test the system by creating a test session and processing notifications
-- First, process any existing pending notifications
UPDATE notifications 
SET status = 'pending', retry_count = 0 
WHERE status = 'pending' AND created_at < now();

-- Create a test session to trigger workflow (this should automatically trigger via database trigger)
INSERT INTO sessions (
  user_id, 
  organization_id, 
  title, 
  scheduled_date,
  session_date,
  session_time,
  status_id,
  project_id
) VALUES (
  'ac32273e-af95-4de9-abed-ce96e6f68139',
  '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45',
  'Test Workflow Session',
  now() + interval '1 day',
  (now() + interval '1 day')::date,
  '14:00',
  (SELECT id FROM session_statuses WHERE organization_id = '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45' AND name = 'Planned' LIMIT 1),
  (SELECT id FROM projects WHERE organization_id = '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45' LIMIT 1)
) RETURNING id;

-- Manually trigger notification processor to test immediate processing  
SELECT net.http_post(
  url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/notification-processor',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
  body := '{"action": "process-pending"}'::jsonb
);