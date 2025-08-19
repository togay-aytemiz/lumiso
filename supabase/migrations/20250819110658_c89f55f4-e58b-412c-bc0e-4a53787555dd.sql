-- Seed basic permissions for role-based access control
INSERT INTO public.permissions (name, description, category) VALUES
-- Project Management
('manage_all_projects', 'Can view and edit all projects in organization', 'projects'),
('create_projects', 'Can create new projects', 'projects'),
('edit_assigned_projects', 'Can edit projects they are assigned to', 'projects'),
('view_assigned_projects', 'Can only view projects they are assigned to', 'projects'),
('delete_projects', 'Can delete projects', 'projects'),

-- Lead Management  
('manage_all_leads', 'Can view and edit all leads in organization', 'leads'),
('create_leads', 'Can create new leads', 'leads'),
('edit_assigned_leads', 'Can edit leads they are assigned to', 'leads'),
('view_assigned_leads', 'Can only view leads they are assigned to', 'leads'),
('delete_leads', 'Can delete leads', 'leads'),

-- Settings Management
('manage_organization_settings', 'Can edit organization-wide settings', 'settings'),
('manage_team_members', 'Can invite/remove team members', 'settings'),
('manage_custom_roles', 'Can create and edit custom roles', 'settings'),
('view_organization_settings', 'Can view organization settings', 'settings'),

-- Session Management
('manage_all_sessions', 'Can view and edit all sessions', 'sessions'),
('create_sessions', 'Can create new sessions', 'sessions'),
('edit_assigned_sessions', 'Can edit sessions for assigned projects/leads', 'sessions'),
('view_assigned_sessions', 'Can only view sessions for assigned projects/leads', 'sessions'),

-- Financial Management
('manage_payments', 'Can manage payments and financial data', 'financial'),
('view_payments', 'Can view payment information', 'financial'),

-- Service & Package Management
('manage_services', 'Can create/edit services and packages', 'services'),
('view_services', 'Can view services and packages', 'services')
ON CONFLICT (name) DO NOTHING;