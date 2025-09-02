-- Phase 4: Setup automated notification processing with cron jobs
-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron jobs for notification processing
-- Process pending immediate notifications every 2 minutes
SELECT cron.schedule(
  'process-pending-notifications',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/notification-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.pzP9NQhHt8Y9ZQfgD0GTaIRYLbUnDO9Wd0HhTYZJxIM"}'::jsonb,
    body := '{"action": "process-pending"}'::jsonb
  );
  $$
);

-- Process scheduled notifications every 15 minutes
SELECT cron.schedule(
  'process-scheduled-notifications',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/notification-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.pzP9NQhHt8Y9ZQfgD0GTaIRYLbUnDO9Wd0HhTYZJxIM"}'::jsonb,
    body := '{"action": "process-scheduled"}'::jsonb
  );
  $$
);

-- Schedule daily summaries for tomorrow every day at 6 AM
SELECT cron.schedule(
  'schedule-daily-summaries',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/notification-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.pzP9NQhHt8Y9ZQfgD0GTaIRYLbUnDO9Wd0HhTYZJxIM"}'::jsonb,
    body := '{"action": "schedule-notification"}'::jsonb
  );
  $$
);

-- Retry failed notifications every hour
SELECT cron.schedule(
  'retry-failed-notifications',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/notification-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.pzP9NQhHt8Y9ZQfgD0GTaIRYLbUnDO9Wd0HhTYZJxIM"}'::jsonb,
    body := '{"action": "retry-failed"}'::jsonb
  );
  $$
);

-- Clean up old notifications every day at 2 AM
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2 * * *',
  $$
  SELECT cleanup_old_notifications();
  $$
);