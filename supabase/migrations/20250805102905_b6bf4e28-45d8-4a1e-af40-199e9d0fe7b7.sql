-- Remove the database triggers that are causing conflicts
DROP TRIGGER IF EXISTS ensure_single_default_project_type_insert_trigger ON public.project_types;
DROP TRIGGER IF EXISTS ensure_single_default_project_type_update_trigger ON public.project_types;

-- We'll handle the single default logic entirely in the application code