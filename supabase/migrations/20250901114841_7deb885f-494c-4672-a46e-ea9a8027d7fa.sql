-- Enable required extensions for cron jobs and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Notification queue table for batch processing
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL, -- 'daily_summary', 'weekly_recap', etc.
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notification delivery logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  email_id TEXT, -- from Resend
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON public.scheduled_notifications(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_org_type ON public.scheduled_notifications(organization_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_org_type ON public.notification_logs(organization_id, notification_type, sent_at);

-- Enable RLS
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_notifications
CREATE POLICY "Organization members can view scheduled notifications" ON public.scheduled_notifications
FOR SELECT USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "System can manage scheduled notifications" ON public.scheduled_notifications
FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for notification_logs  
CREATE POLICY "Organization members can view notification logs" ON public.notification_logs
FOR SELECT USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

CREATE POLICY "System can manage notification logs" ON public.notification_logs
FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_scheduled_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_scheduled_notifications_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_scheduled_notifications_updated_at();

-- Cron job to process scheduled notifications every 15 minutes
SELECT cron.schedule(
  'process-daily-summaries',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://rifdykpdubrowzbylffe.supabase.co/functions/v1/process-scheduled-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
    body:='{"type": "daily-summary"}'::jsonb
  );
  $$
);