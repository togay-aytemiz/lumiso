-- Ensure default session statuses exist per user
CREATE OR REPLACE FUNCTION public.ensure_default_session_statuses(user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.session_statuses WHERE user_id = user_uuid;
  IF cnt = 0 THEN
    INSERT INTO public.session_statuses (user_id, name, color, sort_order, is_system_initial) VALUES
      (user_uuid, 'Planned', '#A0AEC0', 1, true),
      (user_uuid, 'Confirmed', '#ECC94B', 2, false),
      (user_uuid, 'Post processing', '#9F7AEA', 3, false),
      (user_uuid, 'Delivered', '#4299E1', 4, false),
      (user_uuid, 'Completed', '#48BB78', 5, false),
      (user_uuid, 'Cancelled', '#F56565', 6, false);
  END IF;
END;$function$;

-- Get default session status and ensure defaults exist first
CREATE OR REPLACE FUNCTION public.get_default_session_status(user_uuid uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  default_status_id UUID;
BEGIN
  PERFORM public.ensure_default_session_statuses(user_uuid);

  SELECT id INTO default_status_id
  FROM public.session_statuses
  WHERE user_id = user_uuid AND LOWER(name) = 'planned'
  ORDER BY sort_order ASC
  LIMIT 1;

  IF default_status_id IS NULL THEN
    SELECT id INTO default_status_id
    FROM public.session_statuses
    WHERE user_id = user_uuid
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1;
  END IF;

  RETURN default_status_id;
END;$function$;