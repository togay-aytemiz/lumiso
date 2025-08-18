-- Phase 1: Fix Organization Membership & Invite Flow

-- Add status column to organization_members if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organization_members' 
                   AND column_name = 'status') THEN
        ALTER TABLE public.organization_members 
        ADD COLUMN status text NOT NULL DEFAULT 'active';
    END IF;
END $$;

-- Add active_organization_id to user_settings if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_settings' 
                   AND column_name = 'active_organization_id') THEN
        ALTER TABLE public.user_settings 
        ADD COLUMN active_organization_id uuid;
    END IF;
END $$;

-- Create system roles enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_role') THEN
        CREATE TYPE public.system_role AS ENUM ('Owner', 'Member');
    END IF;
END $$;

-- Add system_role column to organization_members if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organization_members' 
                   AND column_name = 'system_role') THEN
        ALTER TABLE public.organization_members 
        ADD COLUMN system_role public.system_role NOT NULL DEFAULT 'Member';
    END IF;
END $$;

-- Update get_user_organization_id function to use active org
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- First try to get the active organization from user settings
  SELECT COALESCE(
    (SELECT us.active_organization_id 
     FROM public.user_settings us 
     WHERE us.user_id = auth.uid() 
     AND us.active_organization_id IS NOT NULL),
    -- Fallback to first active membership
    (SELECT om.organization_id 
     FROM public.organization_members om 
     WHERE om.user_id = auth.uid() 
     AND om.status = 'active'
     ORDER BY om.joined_at ASC 
     LIMIT 1)
  );
$function$;

-- Update ensure_default_packages to be organization-scoped
CREATE OR REPLACE FUNCTION public.ensure_default_packages_for_org(user_uuid uuid, org_id uuid)
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
  -- Check if organization already has packages
  SELECT COUNT(*) INTO package_count 
  FROM public.packages 
  WHERE user_id = user_uuid;
  
  -- Only create defaults if no packages exist for this user
  IF package_count = 0 THEN
    -- First ensure default services exist
    PERFORM public.ensure_default_services_for_org(user_uuid, org_id);
    
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
    
    -- Create packages
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

-- Update ensure_default_services to be organization-scoped
CREATE OR REPLACE FUNCTION public.ensure_default_services_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
      
      -- Digital
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
$function$;

-- Create function to check if user has pending membership (invited)
CREATE OR REPLACE FUNCTION public.user_has_pending_membership(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = user_uuid AND status = 'pending'
  );
$function$;

-- Updated handle_new_user_organization function
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_id uuid;
  pending_membership_exists boolean;
BEGIN
  -- Check if this user has any pending memberships (was invited)
  SELECT public.user_has_pending_membership(NEW.id) INTO pending_membership_exists;
  
  IF pending_membership_exists THEN
    -- User was invited - don't create new org, just create working hours
    INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
    VALUES 
      (NEW.id, 1, true, '09:00', '17:00'), -- Monday
      (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
      (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
      (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
      (NEW.id, 5, true, '09:00', '17:00'), -- Friday
      (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
      (NEW.id, 0, false, '09:00', '17:00'); -- Sunday
    
    RETURN NEW;
  END IF;

  -- User was not invited - create new organization
  org_id := NEW.id; -- Use user ID as org ID for simplicity
  
  -- Create organization membership record as Owner
  INSERT INTO public.organization_members (organization_id, user_id, system_role, status)
  VALUES (org_id, NEW.id, 'Owner', 'active');
  
  -- Set this as the active organization in user settings
  PERFORM public.ensure_user_settings(NEW.id);
  UPDATE public.user_settings 
  SET active_organization_id = org_id 
  WHERE user_id = NEW.id;
  
  -- Create default working hours
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
    (NEW.id, 0, false, '09:00', '17:00'); -- Sunday

  -- Seed default packages and services for this organization
  PERFORM public.ensure_default_packages_for_org(NEW.id, org_id);
  
  RETURN NEW;
END;
$function$;

-- Backfill: Set existing memberships to active status and set active org
UPDATE public.organization_members 
SET status = 'active' 
WHERE status IS NULL OR status = '';

-- Backfill: Set active organization for users who don't have one
INSERT INTO public.user_settings (user_id, active_organization_id)
SELECT DISTINCT om.user_id, om.organization_id
FROM public.organization_members om
WHERE om.status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM public.user_settings us 
  WHERE us.user_id = om.user_id
)
ON CONFLICT (user_id) DO UPDATE SET
  active_organization_id = EXCLUDED.active_organization_id
WHERE user_settings.active_organization_id IS NULL;