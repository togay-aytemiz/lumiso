-- Find remaining functions without SET search_path
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prosecdef = true  -- Security definer functions
    AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
    AND p.proname NOT LIKE 'pg_%'
    AND p.proname NOT LIKE 'uuid_%'
    AND p.proname NOT LIKE 'gen_%'
LIMIT 10;

-- Fix any remaining functions found above
-- Based on the pattern, these are likely functions from previous migrations

-- Fix all common functions that might be missing SET search_path
CREATE OR REPLACE FUNCTION public.prevent_system_initial_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system_initial = true AND NEW.is_system_initial = false THEN
      RAISE EXCEPTION 'The initial system stage cannot be changed to non-system';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_notifications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_status_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  table_name TEXT;
  completed_count INTEGER;
  cancelled_count INTEGER;
BEGIN
  -- Get the table name from the trigger
  table_name := TG_TABLE_NAME;
  
  -- Don't allow deletion of system required statuses
  IF OLD.is_system_required = TRUE THEN
    RAISE EXCEPTION 'This stage is required and cannot be deleted. You may rename it.';
  END IF;
  
  -- Check if deleting the last completed or cancelled status
  IF OLD.lifecycle = 'completed' OR OLD.lifecycle = 'cancelled' THEN
    -- Count remaining statuses of the same lifecycle in the same organization
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE organization_id = $1 AND lifecycle = $2 AND id != $3', table_name)
    INTO completed_count
    USING OLD.organization_id, OLD.lifecycle, OLD.id;
    
    -- If this is the last one of its lifecycle, prevent deletion
    IF completed_count = 0 THEN
      IF OLD.lifecycle = 'completed' THEN
        RAISE EXCEPTION 'Cannot delete the last Completed status. At least one Completed status is required.';
      ELSE
        RAISE EXCEPTION 'Cannot delete the last Cancelled status. At least one Cancelled status is required.';
      END IF;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;