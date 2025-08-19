-- Add granular view and manage permissions for organization settings
INSERT INTO public.permissions (name, description, category) VALUES
-- Organization Settings
('view_organization_settings', 'View organization settings', 'Organization'),
('manage_organization_settings', 'Manage organization settings', 'Organization'),

-- Packages
('view_packages', 'View packages', 'Organization'),
('manage_packages', 'Create, edit, and delete packages', 'Organization'),

-- Services  
('view_services', 'View services', 'Organization'),
('manage_services', 'Create, edit, and delete services', 'Organization'),

-- Lead Statuses
('view_lead_statuses', 'View lead statuses', 'Organization'),
('manage_lead_statuses', 'Create, edit, and delete lead statuses', 'Organization'),

-- Project Statuses
('view_project_statuses', 'View project statuses', 'Organization'),
('manage_project_statuses', 'Create, edit, and delete project statuses', 'Organization'),

-- Session Statuses
('view_session_statuses', 'View session statuses', 'Organization'),
('manage_session_statuses', 'Create, edit, and delete session statuses', 'Organization'),

-- Project Types
('view_project_types', 'View project types', 'Organization'),
('manage_project_types', 'Create, edit, and delete project types', 'Organization');