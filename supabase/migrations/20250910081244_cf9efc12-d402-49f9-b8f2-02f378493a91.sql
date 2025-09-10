-- Update the ensure_organization_settings function to auto-detect timezone for new organizations
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(org_id uuid, detected_timezone text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  settings_id uuid;
  default_timezone text;
BEGIN
  -- Try to get existing settings first
  SELECT id INTO settings_id
  FROM public.organization_settings
  WHERE organization_id = org_id;
  
  -- Only create if none exist
  IF settings_id IS NULL THEN
    -- Use detected timezone or fallback to UTC
    default_timezone := COALESCE(detected_timezone, 'UTC');
    
    INSERT INTO public.organization_settings (
      organization_id,
      date_format,
      time_format,
      photography_business_name,
      primary_brand_color,
      timezone
    ) VALUES (
      org_id,
      'DD/MM/YYYY',
      '12-hour',
      '',
      '#1EB29F',
      default_timezone
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$$;