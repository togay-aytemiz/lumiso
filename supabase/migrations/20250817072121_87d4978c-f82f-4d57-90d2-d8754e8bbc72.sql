-- Add is_sample column to services table
ALTER TABLE public.services 
ADD COLUMN is_sample BOOLEAN DEFAULT false;

-- Create function to ensure default services exist
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
      
      -- Retouching
      (user_uuid, 'Basic Retouch (per photo)', 'Basic color correction and exposure adjustment', 'Retouching', 30, 100, 100, false, true),
      (user_uuid, 'Advanced Retouch (skin, background)', 'Professional skin retouching and background editing', 'Retouching', 80, 200, 200, false, true),
      
      -- Frames
      (user_uuid, 'Wooden Frame', 'Classic wooden frame for prints', 'Frames', 150, 400, 400, false, true),
      (user_uuid, 'Premium Frame (glass protected)', 'High-end frame with protective glass', 'Frames', 300, 700, 700, false, true),
      
      -- Extras
      (user_uuid, 'USB with High-Resolution Photos', 'All photos delivered on branded USB drive', 'Extras', 100, 300, 300, true, true),
      (user_uuid, 'Slideshow Video', 'Professional slideshow with music and transitions', 'Extras', 400, 1000, 1000, true, true);
  END IF;
END;
$$;

-- Update the handle_new_user_organization function to include default services
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create organization member record for new user as Owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'Owner');
  
  -- Create default working hours (Monday to Friday enabled, 9 AM to 5 PM)
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
    (NEW.id, 0, false, '09:00', '17:00'); -- Sunday

  -- Create default packages
  PERFORM public.ensure_default_packages(NEW.id);
  
  -- Create default services
  PERFORM public.ensure_default_services(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Seed default services for all existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM public.organization_members 
    WHERE role = 'Owner'
  LOOP
    PERFORM public.ensure_default_services(user_record.user_id);
  END LOOP;
END $$;