-- Create helper function to get lifecycle for any status type
CREATE OR REPLACE FUNCTION public.get_status_lifecycle(
  status_table text,
  status_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result text;
BEGIN
  -- Validate table name to prevent SQL injection
  IF status_table NOT IN ('lead_statuses', 'project_statuses', 'session_statuses') THEN
    RAISE EXCEPTION 'Invalid status table: %', status_table;
  END IF;
  
  -- Dynamic query with validated table name
  EXECUTE format('SELECT lifecycle FROM %I WHERE id = $1', status_table)
  INTO result
  USING status_id;
  
  -- Return 'active' as default if null
  RETURN COALESCE(result, 'active');
END;
$function$;

-- Create convenience functions for each entity type
CREATE OR REPLACE FUNCTION public.get_lead_lifecycle(status_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT get_status_lifecycle('lead_statuses', status_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_project_lifecycle(status_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT get_status_lifecycle('project_statuses', status_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_session_lifecycle(status_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT get_status_lifecycle('session_statuses', status_id);
$function$;