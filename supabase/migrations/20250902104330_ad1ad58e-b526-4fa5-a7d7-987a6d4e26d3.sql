-- Add new kanban settings for project name and client name visibility
ALTER TABLE public.organization_settings 
ADD COLUMN kanban_show_project_name boolean DEFAULT true,
ADD COLUMN kanban_show_client_name boolean DEFAULT true;