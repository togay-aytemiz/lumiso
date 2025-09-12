-- Ensure all existing organization members have profile records
INSERT INTO public.profiles (user_id, full_name)
SELECT DISTINCT om.user_id, 
  CASE 
    WHEN au.raw_user_meta_data ->> 'full_name' IS NOT NULL 
    THEN au.raw_user_meta_data ->> 'full_name'
    WHEN au.email IS NOT NULL 
    THEN split_part(au.email, '@', 1)
    ELSE 'User ' || substring(om.user_id::text from 1 for 8)
  END as full_name
FROM public.organization_members om
JOIN auth.users au ON om.user_id = au.id
WHERE om.status = 'active' 
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = om.user_id
  );

-- Update the handle_new_user_profile function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  display_name text;
BEGIN
  -- Determine display name with fallbacks
  display_name := NEW.raw_user_meta_data ->> 'full_name';
  
  IF display_name IS NULL OR display_name = '' THEN
    IF NEW.email IS NOT NULL THEN
      display_name := split_part(NEW.email, '@', 1);
    ELSE
      display_name := 'User ' || substring(NEW.id::text from 1 for 8);
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, display_name)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = now();
  
  RETURN NEW;
END;
$$;