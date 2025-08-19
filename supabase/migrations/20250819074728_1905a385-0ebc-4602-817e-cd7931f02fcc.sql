-- Add a check to prevent duplicate email invitations across organizations
CREATE OR REPLACE FUNCTION check_email_not_in_any_organization(email_to_check text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN auth.users u ON om.user_id = u.id
    WHERE u.email = email_to_check
    AND om.status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM invitations i
    WHERE i.email = email_to_check
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  );
$$;