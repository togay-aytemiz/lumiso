-- Clean up permissions table - remove duplicates and keep only working permissions
DELETE FROM public.permissions;

-- Insert only the permissions that are actually implemented in RLS policies
INSERT INTO public.permissions (name, description, category) VALUES
  -- Lead permissions (used in RLS policies)
  ('create_leads', 'Can create new leads', 'leads'),
  ('delete_leads', 'Can delete leads', 'leads'),
  ('view_assigned_leads', 'Can only view leads they are assigned to', 'leads'),
  ('edit_assigned_leads', 'Can edit leads they are assigned to', 'leads'),
  ('manage_all_leads', 'Can view and edit all leads in organization', 'leads'),
  
  -- Project permissions (used in RLS policies)
  ('create_projects', 'Can create new projects', 'projects'),
  ('delete_projects', 'Can delete projects', 'projects'),
  ('view_assigned_projects', 'Can only view projects they are assigned to', 'projects'),
  ('edit_assigned_projects', 'Can edit projects they are assigned to', 'projects'),
  ('manage_all_projects', 'Can view and edit all projects in organization', 'projects'),
  
  -- Session permissions
  ('view_sessions', 'Can view session information', 'sessions'),
  ('create_sessions', 'Can create new sessions', 'sessions'),
  ('manage_sessions', 'Can manage all sessions', 'sessions'),
  
  -- Team management
  ('manage_team', 'Can manage team members and roles', 'team'),
  
  -- Financial permissions
  ('view_payments', 'Can view payment information', 'financial'),
  ('manage_payments', 'Can manage payments and financial data', 'financial');