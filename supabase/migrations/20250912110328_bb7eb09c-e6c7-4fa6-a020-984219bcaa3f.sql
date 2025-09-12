-- Add missing admin-level permissions that are required by protected pages
-- This is idempotent - only inserts if permissions don't already exist

INSERT INTO public.permissions (name, description, category) 
SELECT 'admin', 'Full administrative access to all features', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'admin');

INSERT INTO public.permissions (name, description, category) 
SELECT 'manage_integrations', 'Manage external service integrations', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'manage_integrations');

INSERT INTO public.permissions (name, description, category) 
SELECT 'manage_contracts', 'Manage contract templates and legal documents', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'manage_contracts');

INSERT INTO public.permissions (name, description, category) 
SELECT 'manage_billing', 'Manage billing, payments, and subscription settings', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'manage_billing');

INSERT INTO public.permissions (name, description, category) 
SELECT 'manage_client_messaging', 'Manage client messaging templates and settings', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'manage_client_messaging');