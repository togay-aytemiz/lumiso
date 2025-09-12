-- Find and fix the remaining 2 functions without SET search_path
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
    AND p.proname NOT LIKE 'array_%'
LIMIT 5;

-- Fix validate_lifecycle_change function
CREATE OR REPLACE FUNCTION public.validate_lifecycle_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  table_name TEXT;
  remaining_count INTEGER;
BEGIN
  -- Get the table name from the trigger
  table_name := TG_TABLE_NAME;
  
  -- Don't allow lifecycle changes for system required statuses (they must stay 'active')
  IF OLD.is_system_required = TRUE AND NEW.lifecycle != 'active' THEN
    RAISE EXCEPTION 'System required stages must remain Active.';
  END IF;
  
  -- Check if changing lifecycle would leave no completed or cancelled statuses
  IF OLD.lifecycle != NEW.lifecycle AND (OLD.lifecycle = 'completed' OR OLD.lifecycle = 'cancelled') THEN
    -- Count remaining statuses of the old lifecycle in the same organization
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE organization_id = $1 AND lifecycle = $2 AND id != $3', table_name)
    INTO remaining_count
    USING OLD.organization_id, OLD.lifecycle, OLD.id;
    
    -- If this change would remove the last status of its lifecycle, prevent it
    IF remaining_count = 0 THEN
      IF OLD.lifecycle = 'completed' THEN
        RAISE EXCEPTION 'Cannot change lifecycle - at least one Completed status is required.';
      ELSE
        RAISE EXCEPTION 'Cannot change lifecycle - at least one Cancelled status is required.';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;