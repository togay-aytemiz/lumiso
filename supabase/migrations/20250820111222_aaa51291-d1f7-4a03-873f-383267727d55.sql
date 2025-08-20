-- Add is_system_required flag to all status tables
ALTER TABLE public.lead_statuses 
ADD COLUMN IF NOT EXISTS is_system_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.project_statuses 
ADD COLUMN IF NOT EXISTS is_system_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.session_statuses 
ADD COLUMN IF NOT EXISTS is_system_required BOOLEAN DEFAULT FALSE;

-- Mark system required statuses (idempotent)
UPDATE public.lead_statuses 
SET is_system_required = TRUE 
WHERE LOWER(name) = 'new' AND is_system_required = FALSE;

UPDATE public.project_statuses 
SET is_system_required = TRUE 
WHERE LOWER(name) = 'planned' AND is_system_required = FALSE;

UPDATE public.session_statuses 
SET is_system_required = TRUE 
WHERE LOWER(name) = 'planned' AND is_system_required = FALSE;

-- Create function to validate status deletion
CREATE OR REPLACE FUNCTION validate_status_deletion()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create triggers for all status tables
DROP TRIGGER IF EXISTS validate_lead_status_deletion ON public.lead_statuses;
CREATE TRIGGER validate_lead_status_deletion
  BEFORE DELETE ON public.lead_statuses
  FOR EACH ROW EXECUTE FUNCTION validate_status_deletion();

DROP TRIGGER IF EXISTS validate_project_status_deletion ON public.project_statuses;
CREATE TRIGGER validate_project_status_deletion
  BEFORE DELETE ON public.project_statuses
  FOR EACH ROW EXECUTE FUNCTION validate_status_deletion();

DROP TRIGGER IF EXISTS validate_session_status_deletion ON public.session_statuses;
CREATE TRIGGER validate_session_status_deletion
  BEFORE DELETE ON public.session_statuses
  FOR EACH ROW EXECUTE FUNCTION validate_status_deletion();

-- Create function to validate lifecycle changes
CREATE OR REPLACE FUNCTION validate_lifecycle_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create triggers for lifecycle validation
DROP TRIGGER IF EXISTS validate_lead_lifecycle_change ON public.lead_statuses;
CREATE TRIGGER validate_lead_lifecycle_change
  BEFORE UPDATE ON public.lead_statuses
  FOR EACH ROW EXECUTE FUNCTION validate_lifecycle_change();

DROP TRIGGER IF EXISTS validate_project_lifecycle_change ON public.project_statuses;
CREATE TRIGGER validate_project_lifecycle_change
  BEFORE UPDATE ON public.project_statuses
  FOR EACH ROW EXECUTE FUNCTION validate_lifecycle_change();

DROP TRIGGER IF EXISTS validate_session_lifecycle_change ON public.session_statuses;
CREATE TRIGGER validate_session_lifecycle_change
  BEFORE UPDATE ON public.session_statuses
  FOR EACH ROW EXECUTE FUNCTION validate_lifecycle_change();