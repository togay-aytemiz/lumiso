-- Create RPC that returns all effective permissions for current user
-- Includes implied view_* for each manage_* permission
CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT p.name
  FROM public.permissions p
  WHERE public.user_has_permission(auth.uid(), p.name)
),
implied_view AS (
  SELECT DISTINCT 'view_' || substring(name from 8) AS name
  FROM base
  WHERE name LIKE 'manage_%'
),
combined AS (
  SELECT name FROM base
  UNION
  SELECT name FROM implied_view
)
SELECT COALESCE(ARRAY_AGG(name), ARRAY[]::text[])
FROM combined;
$$;