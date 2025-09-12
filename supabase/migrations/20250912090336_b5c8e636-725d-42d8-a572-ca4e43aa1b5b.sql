-- Fix security definer function search paths and add performance indexes

-- Fix search path for security definer functions
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Check if user has permission through custom role
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN custom_roles cr ON om.custom_role_id = cr.id
    JOIN role_permissions rp ON cr.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = get_user_active_organization_id()
    AND p.name = permission_name
  ) OR EXISTS (
    -- Check system roles (Owner has all permissions)
    SELECT 1 FROM organization_members om
    WHERE om.user_id = user_uuid 
    AND om.status = 'active'
    AND om.organization_id = get_user_active_organization_id()
    AND om.system_role = 'Owner'
  );
$function$;

-- Fix get_user_active_organization_id function
CREATE OR REPLACE FUNCTION public.get_user_active_organization_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Get the active organization from user settings first (most common case)
  SELECT COALESCE(
    (SELECT us.active_organization_id 
     FROM user_settings us 
     WHERE us.user_id = auth.uid() 
     AND us.active_organization_id IS NOT NULL),
    -- Fallback to first active membership if no active org set
    (SELECT om.organization_id 
     FROM organization_members om 
     WHERE om.user_id = auth.uid() 
     AND om.status = 'active'
     ORDER BY om.joined_at ASC 
     LIMIT 1)
  );
$function$;

-- Add performance indexes for team management queries
CREATE INDEX IF NOT EXISTS idx_organization_members_user_org_status 
ON organization_members (user_id, organization_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_status 
ON organization_members (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id 
ON role_permissions (role_id);

CREATE INDEX IF NOT EXISTS idx_custom_roles_org_id 
ON custom_roles (organization_id);

CREATE INDEX IF NOT EXISTS idx_invitations_org_email 
ON invitations (organization_id, email);

CREATE INDEX IF NOT EXISTS idx_invitations_expires_at 
ON invitations (expires_at) WHERE accepted_at IS NULL;

-- Add rate limiting table for invitations
CREATE TABLE IF NOT EXISTS invitation_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  invitation_count integer DEFAULT 0,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS on rate limits table
ALTER TABLE invitation_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policy for rate limits
CREATE POLICY "Users can manage their own rate limits"
ON invitation_rate_limits
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_invitation_rate_limit(user_uuid uuid, org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count integer := 0;
  window_start_time timestamp with time zone;
  rate_limit integer := 10; -- Max 10 invitations per hour
BEGIN
  -- Get or create rate limit record
  SELECT invitation_count, window_start INTO current_count, window_start_time
  FROM invitation_rate_limits 
  WHERE user_id = user_uuid AND organization_id = org_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO invitation_rate_limits (user_id, organization_id, invitation_count, window_start)
    VALUES (user_uuid, org_id, 1, now());
    RETURN true;
  END IF;
  
  -- Check if window has expired (1 hour)
  IF window_start_time < (now() - interval '1 hour') THEN
    -- Reset counter
    UPDATE invitation_rate_limits 
    SET invitation_count = 1, window_start = now()
    WHERE user_id = user_uuid AND organization_id = org_id;
    RETURN true;
  END IF;
  
  -- Check if under rate limit
  IF current_count < rate_limit THEN
    -- Increment counter
    UPDATE invitation_rate_limits 
    SET invitation_count = invitation_count + 1
    WHERE user_id = user_uuid AND organization_id = org_id;
    RETURN true;
  END IF;
  
  -- Rate limit exceeded
  RETURN false;
END;
$$;