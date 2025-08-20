-- Complete data wipe migration - preserves table structure but deletes all data

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

-- Reset any sequences to start fresh
-- This ensures new records start with clean IDs