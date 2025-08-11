-- Reset session_statuses for all existing users to the agreed defaults
DO $$
DECLARE
  _cnt integer;
BEGIN
  -- Capture existing users who currently have any session statuses
  WITH users AS (
    SELECT DISTINCT user_id FROM public.session_statuses
  )
  , deleted AS (
    DELETE FROM public.session_statuses s
    USING users u
    WHERE s.user_id = u.user_id
    RETURNING s.user_id
  )
  INSERT INTO public.session_statuses (user_id, name, color, sort_order, is_system_initial)
  SELECT u.user_id, v.name, v.color, v.sort_order, v.is_system_initial
  FROM (SELECT DISTINCT user_id FROM deleted) AS u
  CROSS JOIN (
    VALUES
      ('Planned', '#A0AEC0', 1, true),
      ('Confirmed', '#ECC94B', 2, false),
      ('Post processing', '#9F7AEA', 3, false),
      ('Delivered', '#4299E1', 4, false),
      ('Completed', '#48BB78', 5, false),
      ('Cancelled', '#F56565', 6, false)
  ) AS v(name, color, sort_order, is_system_initial);
END $$;