-- Create robust permission resolver function
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  user_uuid uuid DEFAULT auth.uid(),
  org_id uuid DEFAULT NULL
)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_system_role public.system_role;
  v_custom_role_id uuid;
  result TEXT[];
BEGIN
  -- Safety checks
  IF user_uuid IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- Resolve organization: explicit param -> active org -> first active membership
  v_org := COALESCE(org_id, public.get_user_active_organization_id());

  IF v_org IS NULL THEN
    SELECT om.organization_id INTO v_org
    FROM public.organization_members om
    WHERE om.user_id = user_uuid AND om.status = 'active'
    ORDER BY om.joined_at ASC
    LIMIT 1;
  END IF;

  IF v_org IS NULL THEN
    RETURN ARRAY[]::TEXT[]; -- No organization context
  END IF;

  -- Get membership
  SELECT om.system_role, om.custom_role_id
  INTO v_system_role, v_custom_role_id
  FROM public.organization_members om
  WHERE om.user_id = user_uuid
    AND om.organization_id = v_org
    AND om.status = 'active'
  LIMIT 1;

  -- Not a member
  IF v_system_role IS NULL AND v_custom_role_id IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- Owner: all permissions
  IF v_system_role = 'Owner'::public.system_role THEN
    SELECT array_agg(p.name ORDER BY p.name) INTO result
    FROM public.permissions p;
    RETURN COALESCE(result, ARRAY[]::TEXT[]);
  END IF;

  -- Custom role: permissions via role_permissions mapping
  IF v_custom_role_id IS NOT NULL THEN
    SELECT array_agg(p.name ORDER BY p.name) INTO result
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = v_custom_role_id;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
  END IF;

  -- Default: no permissions
  RETURN ARRAY[]::TEXT[];
END;
$$;