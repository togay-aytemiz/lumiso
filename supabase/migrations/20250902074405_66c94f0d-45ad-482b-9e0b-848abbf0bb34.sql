-- Update cron job to use service role key instead of anon key for better security
SELECT cron.unschedule('process-daily-summaries');

SELECT cron.schedule(
  'process-daily-summaries',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://rifdykpdubrowzbylffe.supabase.co/functions/v1/process-scheduled-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6InNlcnZpY2Vfa2V5IiwidHlwIjoiSldUIn0.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTczNjk0NTQ5OSwiaXNzIjoiaHR0cHM6Ly9yaWZkeWtwZHVicm93emJ5bGZmZS5zdXBhYmFzZS5jbyIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsInN1YiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIn0.r-9viYr2g42OdCjvj8IEWRMpPRNTGY5gZ8I9PfKW5ro"}'::jsonb,
    body:='{"type": "daily-summary"}'::jsonb
  );
  $$
);