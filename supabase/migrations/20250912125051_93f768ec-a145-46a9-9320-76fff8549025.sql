-- Create missing functions for invitation management

-- Function to validate invitation email
CREATE OR REPLACE FUNCTION public.validate_invitation_email(email_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_email text;
  is_valid boolean := true;
  error_msg text := null;
BEGIN
  -- Basic email validation and normalization
  normalized_email := lower(trim(email_param));
  
  -- Check if email format is valid
  IF normalized_email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
    is_valid := false;
    error_msg := 'Invalid email format';
  END IF;
  
  -- Check if email is already in use by an existing user
  IF is_valid AND EXISTS (
    SELECT 1 FROM auth.users WHERE email = normalized_email
  ) THEN
    is_valid := false;
    error_msg := 'Email is already registered';
  END IF;
  
  RETURN jsonb_build_object(
    'valid', is_valid,
    'normalized_email', normalized_email,
    'error', error_msg
  );
END;
$$;

-- Function to check invitation rate limit
CREATE OR REPLACE FUNCTION public.check_invitation_rate_limit(user_uuid uuid, org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_count integer;
BEGIN
  -- Check invitations sent in the last hour
  SELECT COUNT(*) INTO invitation_count
  FROM invitation_audit_log
  WHERE user_id = user_uuid
    AND organization_id = org_id
    AND created_at > now() - interval '1 hour';
  
  -- Return true if under limit (10 per hour), false if over
  RETURN invitation_count < 10;
END;
$$;

-- Function to log invitation attempt
CREATE OR REPLACE FUNCTION public.log_invitation_attempt(
  user_uuid uuid,
  email_param text,
  org_id uuid,
  success boolean,
  error_message text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO invitation_audit_log (
    user_id,
    organization_id,
    email,
    success,
    error_message,
    created_at
  ) VALUES (
    user_uuid,
    org_id,
    email_param,
    success,
    error_message,
    now()
  );
END;
$$;