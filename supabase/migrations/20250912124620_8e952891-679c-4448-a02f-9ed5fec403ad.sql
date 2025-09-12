-- Remove old role templates and add the 4 required ones
DELETE FROM role_templates;

-- Insert the 4 required role templates
INSERT INTO role_templates (name, description, permissions) VALUES 
(
  'Full Admin', 
  'Complete access to all features and settings', 
  ARRAY[
    'manage_all_leads', 'create_leads', 'delete_leads', 
    'manage_all_projects', 'create_projects', 'delete_projects',
    'manage_all_sessions', 'create_sessions', 'edit_sessions', 'view_sessions',
    'manage_session_statuses', 'manage_project_statuses', 'manage_lead_statuses',
    'manage_services', 'manage_packages', 'manage_project_types',
    'manage_team', 'manage_roles', 'admin',
    'manage_integrations', 'manage_contracts', 'manage_billing', 'manage_client_messaging'
  ]
),
(
  'Manager',
  'Team manager with oversight of projects and team coordination',
  ARRAY[
    'manage_all_leads', 'create_leads', 'edit_assigned_leads', 'view_assigned_leads',
    'manage_all_projects', 'create_projects', 'edit_assigned_projects', 'view_assigned_projects',
    'manage_all_sessions', 'create_sessions', 'edit_sessions', 'view_sessions',
    'view_organization_settings'
  ]
),
(
  'Photographer',
  'Professional photographer with full session and client management capabilities',
  ARRAY[
    'manage_all_leads', 'create_leads', 'edit_assigned_leads', 'view_assigned_leads',
    'manage_all_projects', 'create_projects', 'edit_assigned_projects', 'view_assigned_projects',
    'manage_all_sessions', 'create_sessions', 'edit_sessions', 'view_sessions'
  ]
),
(
  'Organizer',
  'Studio organizer managing leads, projects and client coordination',
  ARRAY[
    'manage_all_leads', 'create_leads', 'edit_assigned_leads', 'view_assigned_leads',
    'create_projects', 'edit_assigned_projects', 'view_assigned_projects',
    'view_sessions', 'create_sessions',
    'view_lead_statuses', 'view_project_statuses', 'view_session_statuses',
    'view_services', 'view_packages', 'view_project_types'
  ]
);