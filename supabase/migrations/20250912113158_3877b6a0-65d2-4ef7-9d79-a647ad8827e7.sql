-- Insert default system roles for organizations
INSERT INTO public.role_templates (name, description, permissions, sort_order) VALUES
  ('Photographer', 'Professional photographer with full session and client management capabilities', 
   '["manage_all_leads", "create_leads", "edit_assigned_leads", "view_assigned_leads", "manage_all_projects", "create_projects", "edit_assigned_projects", "view_assigned_projects", "manage_all_sessions", "create_sessions", "edit_sessions", "view_sessions"]'::jsonb, 
   1),
  ('Manager', 'Team manager with oversight of projects and team coordination', 
   '["manage_all_leads", "create_leads", "edit_assigned_leads", "view_assigned_leads", "manage_all_projects", "create_projects", "edit_assigned_projects", "view_assigned_projects", "manage_all_sessions", "create_sessions", "edit_sessions", "view_sessions", "view_organization_settings"]'::jsonb, 
   2)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  sort_order = EXCLUDED.sort_order;