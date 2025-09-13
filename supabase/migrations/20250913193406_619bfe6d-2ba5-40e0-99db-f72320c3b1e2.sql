-- Remove assignee-related columns from organization_settings
ALTER TABLE public.organization_settings 
DROP COLUMN IF EXISTS kanban_show_assignees;