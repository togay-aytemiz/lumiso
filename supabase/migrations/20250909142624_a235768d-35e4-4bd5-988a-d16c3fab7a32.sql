-- Function to sync lead status options in field definitions
CREATE OR REPLACE FUNCTION public.sync_lead_status_options(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the status field options with current lead statuses
  UPDATE public.lead_field_definitions 
  SET options = jsonb_build_object(
    'options', 
    COALESCE(
      (
        SELECT jsonb_agg(ls.name ORDER BY ls.sort_order)
        FROM public.lead_statuses ls 
        WHERE ls.organization_id = org_id
      ),
      '[]'::jsonb
    )
  )
  WHERE organization_id = org_id 
  AND field_key = 'status';
END;
$$;

-- Function to ensure status field exists and is synced
CREATE OR REPLACE FUNCTION public.ensure_lead_status_field(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create status field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.lead_field_definitions 
    WHERE organization_id = org_id AND field_key = 'status'
  ) THEN
    INSERT INTO public.lead_field_definitions (
      organization_id,
      field_key,
      label,
      field_type,
      is_system,
      is_required,
      is_visible_in_form,
      is_visible_in_table,
      sort_order,
      options
    ) VALUES (
      org_id,
      'status',
      'Status',
      'select',
      true,
      false,
      true,
      true,
      0,
      jsonb_build_object('options', '[]'::jsonb)
    );
    
    -- Update sort order for other fields
    UPDATE public.lead_field_definitions 
    SET sort_order = sort_order + 1 
    WHERE organization_id = org_id AND field_key != 'status';
  END IF;
  
  -- Sync the options
  PERFORM public.sync_lead_status_options(org_id);
END;
$$;