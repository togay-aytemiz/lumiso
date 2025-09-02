-- Phase 1: Create unified notifications table with proper schema (Fixed)
-- First, drop the previous table if it exists
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Create the unified notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('daily-summary', 'weekly-recap', 'project-milestone', 'new-assignment')),
  delivery_method TEXT NOT NULL DEFAULT 'immediate' CHECK (delivery_method IN ('immediate', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_for TIMESTAMP WITH TIME ZONE NULL,
  sent_at TIMESTAMP WITH TIME ZONE NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  email_id TEXT NULL,
  error_message TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_organization_id ON public.notifications(organization_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX idx_notifications_scheduled_for ON public.notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_notifications_retry ON public.notifications(retry_count) WHERE status = 'failed';

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER update_notifications_updated_at_trigger
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notifications_updated_at();

-- Migrate data from existing tables with proper status mapping
-- Migrate notification_logs (map 'success' -> 'sent', 'scheduled' -> 'sent' if sent_at exists)
INSERT INTO public.notifications (
  organization_id,
  user_id,
  notification_type,
  delivery_method,
  status,
  sent_at,
  email_id,
  error_message,
  metadata,
  created_at
)
SELECT 
  organization_id,
  user_id,
  notification_type,
  'immediate' as delivery_method,
  CASE 
    WHEN status = 'success' THEN 'sent'
    WHEN status = 'scheduled' AND sent_at IS NOT NULL THEN 'sent'
    WHEN status = 'scheduled' AND sent_at IS NULL THEN 'pending'
    WHEN status = 'failed' THEN 'failed'
    ELSE 'pending'
  END as status,
  sent_at,
  email_id,
  error_message,
  COALESCE(metadata, '{}') as metadata,
  COALESCE(created_at, now()) as created_at
FROM public.notification_logs;

-- Migrate scheduled_notifications (map status properly)
INSERT INTO public.notifications (
  organization_id,
  user_id,
  notification_type,
  delivery_method,
  status,
  scheduled_for,
  retry_count,
  error_message,
  created_at,
  updated_at
)
SELECT 
  organization_id,
  user_id,
  notification_type,
  'scheduled' as delivery_method,
  CASE 
    WHEN status = 'success' THEN 'sent'
    WHEN status = 'failed' THEN 'failed'
    WHEN status = 'processing' THEN 'processing'
    ELSE 'pending'
  END as status,
  scheduled_for,
  COALESCE(retry_count, 0) as retry_count,
  error_message,
  COALESCE(created_at, now()) as created_at,
  COALESCE(updated_at, now()) as updated_at
FROM public.scheduled_notifications;

-- Add RLS policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view notifications"
ON public.notifications FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  )
);

CREATE POLICY "System can manage notifications"
ON public.notifications FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to clean up old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications 
  WHERE created_at < (now() - interval '30 days')
  AND status IN ('sent', 'failed', 'cancelled');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create function to retry failed notifications
CREATE OR REPLACE FUNCTION public.retry_failed_notifications()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.notifications 
  SET 
    status = 'pending',
    retry_count = retry_count + 1,
    error_message = NULL,
    updated_at = now()
  WHERE status = 'failed' 
  AND retry_count < max_retries
  AND updated_at < (now() - interval '1 hour'); -- Wait at least 1 hour before retry
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';