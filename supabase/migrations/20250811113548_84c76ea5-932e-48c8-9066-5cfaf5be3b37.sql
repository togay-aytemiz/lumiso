-- 1) Rename existing session statuses from "Post processing" to "Editing"
UPDATE public.session_statuses
SET name = 'Editing', sort_order = 3
WHERE LOWER(name) IN ('post processing', 'post-processing', 'postprocessing');

-- 2) Ensure all existing users (derived from owned tables) have default session statuses
WITH all_users AS (
  SELECT user_id FROM public.leads
  UNION SELECT user_id FROM public.projects
  UNION SELECT user_id FROM public.sessions
  UNION SELECT user_id FROM public.activities
  UNION SELECT user_id FROM public.user_settings
  UNION SELECT user_id FROM public.services
  UNION SELECT user_id FROM public.payments
  UNION SELECT user_id FROM public.project_types
  UNION SELECT user_id FROM public.project_statuses
  UNION SELECT user_id FROM public.lead_statuses
),
missing_users AS (
  SELECT au.user_id
  FROM all_users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.session_statuses ss WHERE ss.user_id = au.user_id
  )
)
INSERT INTO public.session_statuses (user_id, name, color, sort_order, is_system_initial)
SELECT mu.user_id, v.name, v.color, v.sort_order, v.is_system_initial
FROM missing_users mu
CROSS JOIN (
  VALUES
    ('Planned',   '#A0AEC0', 1, true),
    ('Confirmed', '#ECC94B', 2, false),
    ('Editing',   '#9F7AEA', 3, false),
    ('Delivered', '#4299E1', 4, false),
    ('Completed', '#48BB78', 5, false),
    ('Cancelled', '#F56565', 6, false)
) AS v(name, color, sort_order, is_system_initial);

-- 3) Ensure the helper function already sets defaults with "Editing" (idempotent)
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
      (user_uuid, 'Planned',   '#A0AEC0', 1, true),
      (user_uuid, 'Confirmed', '#ECC94B', 2, false),
      (user_uuid, 'Editing',   '#9F7AEA', 3, false),
      (user_uuid, 'Delivered', '#4299E1', 4, false),
      (user_uuid, 'Completed', '#48BB78', 5, false),
      (user_uuid, 'Cancelled', '#F56565', 6, false);
  END IF;
END;$function$;