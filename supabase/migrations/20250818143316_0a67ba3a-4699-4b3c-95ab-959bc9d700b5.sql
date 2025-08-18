-- Finalize Organization & Invite Flow

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'My Organization',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organizations
DROP POLICY IF EXISTS "Organization owners can manage their organizations" ON public.organizations;
CREATE POLICY "Organization owners can manage their organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Organization members can view their organizations" ON public.organizations;
CREATE POLICY "Organization members can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Add organization_id to packages and services if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'packages' 
                   AND column_name = 'organization_id') THEN
        ALTER TABLE public.packages 
        ADD COLUMN organization_id uuid;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' 
                   AND column_name = 'organization_id') THEN
        ALTER TABLE public.services 
        ADD COLUMN organization_id uuid;
    END IF;
END $$;

-- Update ensure_default_packages to be organization-scoped and idempotent
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
  -- Check if organization already has packages (idempotent check)
  SELECT COUNT(*) INTO package_count 
  FROM public.packages 
  WHERE organization_id = org_id;
  
  -- Only create defaults if no packages exist for this organization
  IF package_count = 0 THEN
    -- First ensure default services exist
    PERFORM public.ensure_default_services_for_org(user_uuid, org_id);
    
    -- Get service IDs by name for this organization
    SELECT id INTO wedding_album_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Standard Wedding Album' AND is_sample = true LIMIT 1;
    
    SELECT id INTO parent_album_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Parent Album (smaller copy)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO basic_retouch_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Basic Retouch (per photo)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO small_print_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Small Print (13x18cm)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO slideshow_video_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Slideshow Video' AND is_sample = true LIMIT 1;
    
    SELECT id INTO usb_photos_id FROM public.services 
    WHERE organization_id = org_id AND name = 'USB with High-Resolution Photos' AND is_sample = true LIMIT 1;
    
    SELECT id INTO large_print_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Large Print (50x70cm)' AND is_sample = true LIMIT 1;
    
    SELECT id INTO wooden_frame_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Wooden Frame' AND is_sample = true LIMIT 1;
    
    SELECT id INTO premium_frame_id FROM public.services 
    WHERE organization_id = org_id AND name = 'Premium Frame (glass protected)' AND is_sample = true LIMIT 1;
    
    -- Create packages with organization_id
    INSERT INTO public.packages (user_id, organization_id, name, description, price, duration, applicable_types, default_add_ons, is_active) VALUES
      (user_uuid, org_id, 'Wedding Standard', 'Full day wedding coverage with essentials', 15000, 'Full day', ARRAY['Wedding'], 
       ARRAY[wedding_album_id::TEXT, parent_album_id::TEXT, basic_retouch_id::TEXT], true),
       
      (user_uuid, org_id, 'Engagement Session', 'Casual outdoor or studio engagement photoshoot', 3500, '2 hours', ARRAY['Portrait'], 
       ARRAY[small_print_id::TEXT, slideshow_video_id::TEXT], true),
       
      (user_uuid, org_id, 'Newborn Session', 'In-home newborn session with props and editing', 4500, '3 hours', ARRAY['Newborn'], 
       ARRAY[usb_photos_id::TEXT, small_print_id::TEXT], true),
       
      (user_uuid, org_id, 'Baby Milestone Package', 'Capture 3, 6, 12 month milestones', 6500, 'multi-session', ARRAY['Family', 'Newborn'], 
       ARRAY[large_print_id::TEXT, wedding_album_id::TEXT], true),
       
      (user_uuid, org_id, 'Family Portrait', 'Lifestyle family photography in studio or outdoor', 3000, '1 hour', ARRAY['Family', 'Portrait'], 
       ARRAY[wooden_frame_id::TEXT, large_print_id::TEXT], true),
       
      (user_uuid, org_id, 'Event Coverage Standard', 'Full coverage for corporate or private events', 7500, '6 hours', ARRAY['Corporate', 'Event'], 
       ARRAY[usb_photos_id::TEXT, premium_frame_id::TEXT], true);
  END IF;
END;
$function$;

-- Update ensure_default_services to be organization-scoped and idempotent
CREATE OR REPLACE FUNCTION public.ensure_default_services_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  sample_service_count INTEGER;
BEGIN
  -- Check if organization already has sample services (idempotent check)
  SELECT COUNT(*) INTO sample_service_count 
  FROM public.services 
  WHERE organization_id = org_id AND is_sample = true;
  
  -- Only create defaults if no sample services exist for this organization
  IF sample_service_count = 0 THEN
    INSERT INTO public.services (user_id, organization_id, name, description, category, cost_price, selling_price, price, extra, is_sample) VALUES
      -- Albums
      (user_uuid, org_id, 'Standard Wedding Album', 'Professional wedding album with premium binding', 'Albums', 1500, 3000, 3000, false, true),
      (user_uuid, org_id, 'Parent Album (smaller copy)', 'Smaller copy of main album for parents', 'Albums', 800, 1500, 1500, false, true),
      
      -- Prints
      (user_uuid, org_id, 'Large Print (50x70cm)', 'High-quality large format print', 'Prints', 200, 500, 500, false, true),
      (user_uuid, org_id, 'Small Print (13x18cm)', 'Standard size photo print', 'Prints', 20, 60, 60, false, true),
      
      -- Digital
      (user_uuid, org_id, 'USB with High-Resolution Photos', 'All photos delivered on branded USB drive', 'Digital', 100, 300, 300, true, true),
      (user_uuid, org_id, 'Slideshow Video', 'Professional slideshow with music and transitions', 'Digital', 400, 1000, 1000, true, true),
      
      -- Retouching
      (user_uuid, org_id, 'Basic Retouch (per photo)', 'Basic color correction and exposure adjustment', 'Retouching', 30, 100, 100, false, true),
      (user_uuid, org_id, 'Advanced Retouch (skin, background)', 'Professional skin retouching and background editing', 'Retouching', 80, 200, 200, false, true),
      
      -- Frames
      (user_uuid, org_id, 'Wooden Frame', 'Classic wooden frame for prints', 'Frames', 150, 400, 400, false, true),
      (user_uuid, org_id, 'Premium Frame (glass protected)', 'High-end frame with protective glass', 'Frames', 300, 700, 700, false, true);
  END IF;
END;
$function$;

-- Updated handle_new_user_organization function to create proper organizations
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
    -- Standardize working hours (0=Sunday, 1=Monday, ..., 6=Saturday)
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
  INSERT INTO public.organizations (owner_id, name)
  VALUES (NEW.id, 'My Organization')
  RETURNING id INTO org_id;
  
  -- Create organization membership record as Owner
  INSERT INTO public.organization_members (organization_id, user_id, system_role, status)
  VALUES (org_id, NEW.id, 'Owner', 'active');
  
  -- Set this as the active organization in user settings
  PERFORM public.ensure_user_settings(NEW.id);
  UPDATE public.user_settings 
  SET active_organization_id = org_id 
  WHERE user_id = NEW.id;
  
  -- Create default working hours (standardized: 0=Sunday, 1=Monday, ..., 6=Saturday)
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

-- Backfill: Create organizations for existing users who don't have them
INSERT INTO public.organizations (id, owner_id, name, created_at)
SELECT 
  om.organization_id,
  om.user_id,
  'My Organization',
  om.joined_at
FROM public.organization_members om
WHERE om.system_role = 'Owner' 
AND om.status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM public.organizations o 
  WHERE o.id = om.organization_id
)
ON CONFLICT (id) DO NOTHING;

-- Backfill: Update packages and services with organization_id
UPDATE public.packages 
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om 
  WHERE om.user_id = packages.user_id 
  AND om.status = 'active' 
  LIMIT 1
)
WHERE organization_id IS NULL;

UPDATE public.services 
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om 
  WHERE om.user_id = services.user_id 
  AND om.status = 'active' 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Clean up duplicate packages/services per organization (keep the first one)
DELETE FROM public.packages 
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id, name) id
  FROM public.packages
  WHERE organization_id IS NOT NULL
  ORDER BY organization_id, name, created_at ASC
);

DELETE FROM public.services 
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id, name) id
  FROM public.services
  WHERE organization_id IS NOT NULL
  ORDER BY organization_id, name, created_at ASC
);

-- Remove empty organizations (organizations with no active members)
DELETE FROM public.organizations 
WHERE id NOT IN (
  SELECT DISTINCT organization_id 
  FROM public.organization_members 
  WHERE status = 'active'
);

-- Update RLS policies for packages and services to use organization_id
DROP POLICY IF EXISTS "Users can view their own packages" ON public.packages;
CREATE POLICY "Organization members can view packages"
ON public.packages
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can create their own packages" ON public.packages;
CREATE POLICY "Organization members can create packages"
ON public.packages
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can update their own packages" ON public.packages;
CREATE POLICY "Organization members can update packages"
ON public.packages
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can delete their own packages" ON public.packages;
CREATE POLICY "Organization members can delete packages"
ON public.packages
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Update RLS policies for services
DROP POLICY IF EXISTS "Users can view their own services" ON public.services;
CREATE POLICY "Organization members can view services"
ON public.services
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can create their own services" ON public.services;
CREATE POLICY "Organization members can create services"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can update their own services" ON public.services;
CREATE POLICY "Organization members can update services"
ON public.services
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can delete their own services" ON public.services;
CREATE POLICY "Organization members can delete services"
ON public.services
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);