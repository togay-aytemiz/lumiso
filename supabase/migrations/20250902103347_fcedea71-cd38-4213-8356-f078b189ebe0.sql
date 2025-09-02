-- Add kanban card visibility settings to organization_settings table
ALTER TABLE public.organization_settings 
ADD COLUMN kanban_show_project_type boolean DEFAULT true,
ADD COLUMN kanban_show_assignees boolean DEFAULT true,
ADD COLUMN kanban_show_todo_progress boolean DEFAULT true,
ADD COLUMN kanban_show_session_count boolean DEFAULT true,
ADD COLUMN kanban_show_service_count boolean DEFAULT true;