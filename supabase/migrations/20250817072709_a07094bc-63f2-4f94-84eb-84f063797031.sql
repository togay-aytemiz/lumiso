-- Update the ensure_default_services function to use correct system default categories
CREATE OR REPLACE FUNCTION public.ensure_default_services(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sample_service_count INTEGER;
BEGIN
  -- Check if user already has sample services
  SELECT COUNT(*) INTO sample_service_count 
  FROM public.services 
  WHERE user_id = user_uuid AND is_sample = true;
  
  -- Only create defaults if no sample services exist
  IF sample_service_count = 0 THEN
    INSERT INTO public.services (user_id, name, description, category, cost_price, selling_price, price, extra, is_sample) VALUES
      -- Albums
      (user_uuid, 'Standard Wedding Album', 'Professional wedding album with premium binding', 'Albums', 1500, 3000, 3000, false, true),
      (user_uuid, 'Parent Album (smaller copy)', 'Smaller copy of main album for parents', 'Albums', 800, 1500, 1500, false, true),
      
      -- Prints
      (user_uuid, 'Large Print (50x70cm)', 'High-quality large format print', 'Prints', 200, 500, 500, false, true),
      (user_uuid, 'Small Print (13x18cm)', 'Standard size photo print', 'Prints', 20, 60, 60, false, true),
      
      -- Digital (not Extras)
      (user_uuid, 'USB with High-Resolution Photos', 'All photos delivered on branded USB drive', 'Digital', 100, 300, 300, true, true),
      (user_uuid, 'Slideshow Video', 'Professional slideshow with music and transitions', 'Digital', 400, 1000, 1000, true, true),
      
      -- Retouching
      (user_uuid, 'Basic Retouch (per photo)', 'Basic color correction and exposure adjustment', 'Retouching', 30, 100, 100, false, true),
      (user_uuid, 'Advanced Retouch (skin, background)', 'Professional skin retouching and background editing', 'Retouching', 80, 200, 200, false, true),
      
      -- Frames
      (user_uuid, 'Wooden Frame', 'Classic wooden frame for prints', 'Frames', 150, 400, 400, false, true),
      (user_uuid, 'Premium Frame (glass protected)', 'High-end frame with protective glass', 'Frames', 300, 700, 700, false, true);
  END IF;
END;
$$;

-- Update existing seeded services to use correct categories for all users
UPDATE public.services 
SET category = 'Digital'
WHERE is_sample = true 
AND name IN ('USB with High-Resolution Photos', 'Slideshow Video')
AND category = 'Extras';

-- Re-seed services for existing users with corrected categories
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM public.organization_members 
    WHERE role = 'Owner'
  LOOP
    -- Delete existing sample services to avoid duplicates
    DELETE FROM public.services 
    WHERE user_id = user_record.user_id AND is_sample = true;
    
    -- Re-create with correct categories
    PERFORM public.ensure_default_services(user_record.user_id);
  END LOOP;
END $$;