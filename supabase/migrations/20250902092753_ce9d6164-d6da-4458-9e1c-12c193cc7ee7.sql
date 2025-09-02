-- Phase 5: Deprecate old notification tables (keep for backup/migration period)
-- Add comments to indicate these tables are deprecated
COMMENT ON TABLE public.notification_logs IS 'DEPRECATED: Use public.notifications table instead. This table is kept for migration backup purposes only.';
COMMENT ON TABLE public.scheduled_notifications IS 'DEPRECATED: Use public.notifications table instead. This table is kept for migration backup purposes only.';

-- Create view for backward compatibility during transition period
CREATE OR REPLACE VIEW public.legacy_notification_logs AS
SELECT 
  id,
  organization_id,
  user_id,
  notification_type,
  sent_at as created_at,
  status,
  email_id,
  error_message,
  metadata
FROM public.notifications
WHERE delivery_method = 'immediate';

CREATE OR REPLACE VIEW public.legacy_scheduled_notifications AS
SELECT 
  id,
  organization_id,
  user_id,
  notification_type,
  scheduled_for,
  status,
  retry_count,
  sent_at as last_attempt,
  error_message,
  created_at,
  updated_at
FROM public.notifications  
WHERE delivery_method = 'scheduled';