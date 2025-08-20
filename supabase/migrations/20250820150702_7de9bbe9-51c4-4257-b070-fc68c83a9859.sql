-- Complete data wipe migration - temporarily disable validation triggers

-- Temporarily disable validation triggers
DROP TRIGGER IF EXISTS validate_lead_status_deletion ON public.lead_statuses;
DROP TRIGGER IF EXISTS validate_project_status_deletion ON public.project_statuses; 
DROP TRIGGER IF EXISTS validate_session_status_deletion ON public.session_statuses;
DROP TRIGGER IF EXISTS validate_lead_status_lifecycle_change ON public.lead_statuses;
DROP TRIGGER IF EXISTS validate_project_status_lifecycle_change ON public.project_statuses;
DROP TRIGGER IF EXISTS validate_session_status_lifecycle_change ON public.session_statuses;

-- Delete all data in the correct order to respect foreign key constraints

-- Delete activities first (references leads and projects)
DELETE FROM public.activities;

-- Delete project-related data  
DELETE FROM public.project_services;
DELETE FROM public.todos;
DELETE FROM public.payments;
DELETE FROM public.sessions;
DELETE FROM public.projects;

-- Delete leads
DELETE FROM public.leads;

-- Delete other user data
DELETE FROM public.appointments;
DELETE FROM public.audit_log;

-- Delete organization structure
DELETE FROM public.invitations;
DELETE FROM public.organization_members;
DELETE FROM public.organizations;

-- Delete role and permission data
DELETE FROM public.role_permissions;
DELETE FROM public.custom_roles;

-- Delete configuration data (will be recreated for new users)
DELETE FROM public.services;
DELETE FROM public.packages;
DELETE FROM public.project_types;
DELETE FROM public.project_statuses;
DELETE FROM public.lead_statuses;
DELETE FROM public.session_statuses;

-- Delete user settings and profiles
DELETE FROM public.user_settings;
DELETE FROM public.organization_settings;
DELETE FROM public.profiles;
DELETE FROM public.working_hours;
DELETE FROM public.google_calendar_tokens;

-- Re-enable validation triggers
CREATE TRIGGER validate_lead_status_deletion
  BEFORE DELETE ON public.lead_statuses
  FOR EACH ROW
  EXECUTE FUNCTION validate_status_deletion();

CREATE TRIGGER validate_project_status_deletion
  BEFORE DELETE ON public.project_statuses
  FOR EACH ROW
  EXECUTE FUNCTION validate_status_deletion();

CREATE TRIGGER validate_session_status_deletion
  BEFORE DELETE ON public.session_statuses
  FOR EACH ROW
  EXECUTE FUNCTION validate_status_deletion();

CREATE TRIGGER validate_lead_status_lifecycle_change
  BEFORE UPDATE ON public.lead_statuses
  FOR EACH ROW
  EXECUTE FUNCTION validate_lifecycle_change();

CREATE TRIGGER validate_project_status_lifecycle_change
  BEFORE UPDATE ON public.project_statuses
  FOR EACH ROW
  EXECUTE FUNCTION validate_lifecycle_change();

CREATE TRIGGER validate_session_status_lifecycle_change
  BEFORE UPDATE ON public.session_statuses
  FOR EACH ROW
  EXECUTE FUNCTION validate_lifecycle_change();