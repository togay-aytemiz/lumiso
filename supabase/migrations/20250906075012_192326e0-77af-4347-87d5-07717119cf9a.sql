-- Test the complete system by creating daily summary notification and triggering workflow executor
-- 1. Create a daily summary notification to test email sending
INSERT INTO notifications (
  organization_id,
  user_id,
  notification_type,
  delivery_method,
  scheduled_for,
  metadata,
  status
) VALUES (
  '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45',
  'ac32273e-af95-4de9-abed-ce96e6f68139',
  'daily-summary',
  'scheduled',
  now(),
  json_build_object(
    'date', current_date::text,
    'organization_name', 'Test Organization'
  ),
  'pending'
);

-- 2. Test workflow executor manually for the session we created
SELECT net.http_post(
  url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/workflow-executor',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
  body := json_build_object(
    'action', 'trigger',
    'triggerType', 'session_scheduled',
    'entityType', 'session',
    'entityId', '0b81874d-e7d0-4af9-968c-29ef05f6182c',
    'organizationId', '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45',
    'triggerData', json_build_object(
      'session_id', '0b81874d-e7d0-4af9-968c-29ef05f6182c',
      'session_date', '2025-09-05',
      'session_time', '14:00',
      'location', 'Studio Location',
      'notes', 'Test workflow session to verify email notifications are working'
    )
  )::jsonb
);

-- 3. Trigger notification processor to process pending notifications
SELECT net.http_post(
  url := 'https://rifdykpdubrowzbylffe.supabase.co/functions/v1/notification-processor',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
  body := '{"action": "process-pending"}'::jsonb
);