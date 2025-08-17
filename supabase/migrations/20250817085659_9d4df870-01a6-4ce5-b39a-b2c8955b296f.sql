-- Update package persistence to fix invalid project types
-- Replace invalid types with existing valid ones

-- Update packages with corrected applicable_types
UPDATE packages 
SET applicable_types = ARRAY['Wedding']::text[]
WHERE 'Engagement' = ANY(applicable_types) AND name = 'Wedding Standard';

UPDATE packages 
SET applicable_types = ARRAY['Portrait']::text[]
WHERE 'Engagement' = ANY(applicable_types) AND name = 'Engagement Session';

UPDATE packages 
SET applicable_types = ARRAY['Newborn']::text[]
WHERE ('Newborn' = ANY(applicable_types) OR 'Family' = ANY(applicable_types)) AND name = 'Newborn Session';

UPDATE packages 
SET applicable_types = ARRAY['Family', 'Newborn']::text[]
WHERE ('Baby' = ANY(applicable_types) OR 'Family' = ANY(applicable_types)) AND name = 'Baby Milestone Package';

UPDATE packages 
SET applicable_types = ARRAY['Family', 'Portrait']::text[]
WHERE ('Family' = ANY(applicable_types) OR 'Portrait' = ANY(applicable_types)) AND name = 'Family Portrait';

UPDATE packages 
SET applicable_types = ARRAY['Corporate', 'Event']::text[]
WHERE ('Corporate' = ANY(applicable_types) OR 'Event' = ANY(applicable_types)) AND name = 'Event Coverage Standard';

-- Also update the ensure_default_packages function to use correct types
CREATE OR REPLACE FUNCTION public.ensure_default_packages(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  package_count INTEGER;
  wedding_album_id UUID;
  parent_album_id UUID;
  basic_retouch_id UUID;
  small_print_id UUID;
  slideshow_video_id UUID;
  usb_photos_id UUID;
  large_print_id UUID;
  wooden_frame_id UUID;
  premium_frame_id UUID;
BEGIN
  -- Check if user already has packages
  SELECT COUNT(*) INTO package_count 
  FROM public.packages 
  WHERE user_id = user_uuid;
  
  -- Only create defaults if no packages exist
  IF package_count = 0 THEN
    -- First ensure default services exist
    PERFORM public.ensure_default_services(user_uuid);
    
    -- Get service IDs by name for this user
    SELECT id INTO wedding_album_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Standard Wedding Album' AND is_sample = true LIMIT 1;
    
    SELECT id INTO parent_album_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Parent Album (smaller copy)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO basic_retouch_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Basic Retouch (per photo)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO small_print_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Small Print (13x18cm)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO slideshow_video_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Slideshow Video' AND is_sample = true LIMIT 1;
    
    SELECT id INTO usb_photos_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'USB with High-Resolution Photos' AND is_sample = true LIMIT 1;
    
    SELECT id INTO large_print_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Large Print (50x70cm)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO wooden_frame_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Wooden Frame' AND is_sample = true LIMIT 1;
    
    SELECT id INTO premium_frame_id FROM public.services 
    WHERE user_id = user_uuid AND name = 'Premium Frame (glass protected)' AND is_sample = true LIMIT 1;
    
    -- Create packages with corrected applicable_types
    INSERT INTO public.packages (user_id, name, description, price, duration, applicable_types, default_add_ons, is_active) VALUES
      (user_uuid, 'Wedding Standard', 'Full day wedding coverage with essentials', 15000, 'Full day', ARRAY['Wedding'], 
       ARRAY[wedding_album_id::TEXT, parent_album_id::TEXT, basic_retouch_id::TEXT], true),
       
      (user_uuid, 'Engagement Session', 'Casual outdoor or studio engagement photoshoot', 3500, '2 hours', ARRAY['Portrait'], 
       ARRAY[small_print_id::TEXT, slideshow_video_id::TEXT], true),
       
      (user_uuid, 'Newborn Session', 'In-home newborn session with props and editing', 4500, '3 hours', ARRAY['Newborn'], 
       ARRAY[usb_photos_id::TEXT, small_print_id::TEXT], true),
       
      (user_uuid, 'Baby Milestone Package', 'Capture 3, 6, 12 month milestones', 6500, 'multi-session', ARRAY['Family', 'Newborn'], 
       ARRAY[large_print_id::TEXT, wedding_album_id::TEXT], true),
       
      (user_uuid, 'Family Portrait', 'Lifestyle family photography in studio or outdoor', 3000, '1 hour', ARRAY['Family', 'Portrait'], 
       ARRAY[wooden_frame_id::TEXT, large_print_id::TEXT], true),
       
      (user_uuid, 'Event Coverage Standard', 'Full coverage for corporate or private events', 7500, '6 hours', ARRAY['Corporate', 'Event'], 
       ARRAY[usb_photos_id::TEXT, premium_frame_id::TEXT], true);
  END IF;
END;
$function$;