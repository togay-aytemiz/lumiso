-- Fix NULL values first, then update policies
-- Update settings tables with proper organization_id values

-- Project Types - fix NULL values first
UPDATE public.project_types 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = project_types.user_id
)
WHERE organization_id IS NULL;

-- Project Statuses - fix NULL values first  
UPDATE public.project_statuses 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = project_statuses.user_id
)
WHERE organization_id IS NULL;

-- Lead Statuses - fix NULL values first
UPDATE public.lead_statuses 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = lead_statuses.user_id
)
WHERE organization_id IS NULL;

-- Session Statuses - fix NULL values first
UPDATE public.session_statuses 
SET organization_id = (
  SELECT us.active_organization_id 
  FROM public.user_settings us 
  WHERE us.user_id = session_statuses.user_id
)
WHERE organization_id IS NULL;