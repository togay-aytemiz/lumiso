-- Remove the problematic trigger entirely
DROP TRIGGER IF EXISTS ensure_single_default_project_type_trigger ON project_types;
DROP FUNCTION IF EXISTS ensure_single_default_project_type();