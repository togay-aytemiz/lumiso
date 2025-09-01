-- Update the notification_logs status check constraint to allow 'scheduled' status
ALTER TABLE public.notification_logs 
DROP CONSTRAINT IF EXISTS notification_logs_status_check;

ALTER TABLE public.notification_logs 
ADD CONSTRAINT notification_logs_status_check 
CHECK (status = ANY (ARRAY['success'::text, 'failed'::text, 'scheduled'::text, 'pending'::text]));