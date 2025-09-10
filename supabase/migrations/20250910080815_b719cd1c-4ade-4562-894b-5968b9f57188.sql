-- Add timezone column to organization_settings table
ALTER TABLE public.organization_settings 
ADD COLUMN timezone text DEFAULT 'UTC';

-- Update the ensure_organization_settings function to include timezone
CREATE OR REPLACE FUNCTION public.ensure_organization_settings(org_id uuid, detected_timezone text DEFAULT 'UTC')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  settings_id uuid;
BEGIN
  -- Try to get existing settings first
  SELECT id INTO settings_id
  FROM public.organization_settings
  WHERE organization_id = org_id;
  
  -- Only create if none exist
  IF settings_id IS NULL THEN
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
      COALESCE(detected_timezone, 'UTC')
    ) RETURNING id INTO settings_id;
  END IF;
  
  RETURN settings_id;
END;
$$;