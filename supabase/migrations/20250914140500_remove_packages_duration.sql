-- Remove duration column from packages and refresh default seeding helpers

ALTER TABLE public.packages DROP COLUMN IF EXISTS duration;

-- Update legacy helper for single-user setups
CREATE OR REPLACE FUNCTION public.ensure_default_packages(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  package_count integer;
BEGIN
  SELECT COUNT(*) INTO package_count
  FROM public.packages
  WHERE user_id = user_uuid;

  IF package_count = 0 THEN
    INSERT INTO public.packages (user_id, name, description, price, applicable_types, default_add_ons, is_active)
    VALUES
      (user_uuid, 'Wedding Standard', 'Full day wedding coverage with essentials', 15000, ARRAY['Wedding', 'Engagement'], ARRAY[]::text[], true),
      (user_uuid, 'Engagement Session', 'Casual outdoor or studio engagement photoshoot', 3500, ARRAY['Engagement'], ARRAY[]::text[], true),
      (user_uuid, 'Newborn Session', 'In-home newborn session with props and editing', 4500, ARRAY['Newborn', 'Family'], ARRAY[]::text[], true),
      (user_uuid, 'Baby Milestone Package', 'Capture 3, 6, 12 month milestones', 6500, ARRAY['Baby', 'Family'], ARRAY[]::text[], true),
      (user_uuid, 'Family Portrait', 'Lifestyle family photography in studio or outdoor', 3000, ARRAY['Family', 'Portrait'], ARRAY[]::text[], true),
      (user_uuid, 'Event Coverage Standard', 'Full coverage for corporate or private events', 7500, ARRAY['Corporate', 'Event'], ARRAY[]::text[], true);
  END IF;
END;
$function$;

-- Organization-scoped default seeding
CREATE OR REPLACE FUNCTION public.ensure_default_packages_for_org(user_uuid uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  package_count integer;
  wedding_album_id uuid;
  parent_album_id uuid;
  basic_retouch_id uuid;
  small_print_id uuid;
  slideshow_video_id uuid;
  usb_photos_id uuid;
  large_print_id uuid;
  wooden_frame_id uuid;
  premium_frame_id uuid;
BEGIN
  SELECT COUNT(*) INTO package_count
  FROM public.packages
  WHERE organization_id = org_id;

  IF package_count = 0 THEN
    PERFORM public.ensure_default_services_for_org(user_uuid, org_id);

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

    INSERT INTO public.packages (user_id, organization_id, name, description, price, applicable_types, default_add_ons, is_active)
    VALUES
      (user_uuid, org_id, 'Wedding Standard', 'Full day wedding coverage with essentials', 15000, ARRAY['Wedding'], ARRAY[wedding_album_id::text, parent_album_id::text, basic_retouch_id::text], true),
      (user_uuid, org_id, 'Engagement Session', 'Casual outdoor or studio engagement photoshoot', 3500, ARRAY['Portrait'], ARRAY[small_print_id::text, slideshow_video_id::text], true),
      (user_uuid, org_id, 'Newborn Session', 'In-home newborn session with props and editing', 4500, ARRAY['Newborn'], ARRAY[usb_photos_id::text, small_print_id::text], true),
      (user_uuid, org_id, 'Baby Milestone Package', 'Capture 3, 6, 12 month milestones', 6500, ARRAY['Family', 'Newborn'], ARRAY[large_print_id::text, wedding_album_id::text], true),
      (user_uuid, org_id, 'Family Portrait', 'Lifestyle family photography in studio or outdoor', 3000, ARRAY['Family', 'Portrait'], ARRAY[wooden_frame_id::text, large_print_id::text], true),
      (user_uuid, org_id, 'Event Coverage Standard', 'Full coverage for corporate or private events', 7500, ARRAY['Corporate', 'Event'], ARRAY[usb_photos_id::text, premium_frame_id::text], true);
  END IF;
END;
$function$;
