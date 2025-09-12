-- Add automation permissions for workflows and templates
INSERT INTO public.permissions (name, description, category) VALUES
('manage_workflows', 'Create, edit, and delete workflows', 'automation'),
('view_workflows', 'View workflows list and details', 'automation'),
('execute_workflows', 'Trigger workflow executions', 'automation'),
('manage_templates', 'Create, edit, and delete message templates', 'automation'),
('view_templates', 'View templates list and details', 'automation');