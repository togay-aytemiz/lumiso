-- Remove assignment notification columns from user_settings
ALTER TABLE public.user_settings 
DROP COLUMN IF EXISTS notification_new_assignment_enabled;

-- Remove assignment notification columns from organization_settings  
ALTER TABLE public.organization_settings
DROP COLUMN IF EXISTS notification_new_assignment_enabled;

-- Remove assignment notification records from notifications table
DELETE FROM public.notifications 
WHERE notification_type = 'new-assignment';

-- Clean up any remaining assignment workflow executions
DELETE FROM public.workflow_executions 
WHERE trigger_entity_type IN ('lead', 'project') 
AND execution_log::text LIKE '%assignment%';