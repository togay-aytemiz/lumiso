-- Add 'workflow-message' to the allowed notification types
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_notification_type_check 
CHECK (notification_type = ANY (ARRAY['daily-summary'::text, 'weekly-recap'::text, 'project-milestone'::text, 'new-assignment'::text, 'workflow-message'::text]));