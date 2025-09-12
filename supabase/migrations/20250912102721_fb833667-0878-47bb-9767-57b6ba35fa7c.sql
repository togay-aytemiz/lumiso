-- Create missing rate limiting function for invitations
CREATE OR REPLACE FUNCTION public.check_invitation_rate_limit(
  user_uuid uuid,
  org_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_count INTEGER;
BEGIN
  -- Count invitations sent by this user in the last hour for this organization
  SELECT COUNT(*) INTO invitation_count
  FROM public.invitations
  WHERE invited_by = user_uuid
    AND organization_id = org_id
    AND created_at > (NOW() - INTERVAL '1 hour');
  
  -- Return true if under the limit (10 per hour)
  RETURN invitation_count < 10;
END;
$$;

-- Create invitation audit log function
CREATE OR REPLACE FUNCTION public.log_invitation_attempt(
  user_uuid uuid,
  email_param text,
  org_id uuid,
  success boolean,
  error_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.invitation_audit_log (
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
    NOW()
  );
END;
$$;

-- Create audit log table for invitation attempts
CREATE TABLE IF NOT EXISTS public.invitation_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  email text NOT NULL,
  success boolean NOT NULL,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log table
ALTER TABLE public.invitation_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for audit log (organization owners can view)
CREATE POLICY "Organization owners can view invitation audit logs"
ON public.invitation_audit_log
FOR SELECT
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o
    WHERE o.owner_id = auth.uid()
  )
);

-- Create enhanced email validation function
CREATE OR REPLACE FUNCTION public.validate_invitation_email(
  email_param text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_email text;
  domain_part text;
  temp_domains text[] := ARRAY[
    '10minutemail.com', 'guerrillamail.com', 'tempmail.org', 
    'throwaway.email', 'mailinator.com', 'yopmail.com'
  ];
BEGIN
  -- Normalize email
  normalized_email := LOWER(TRIM(email_param));
  
  -- Basic format validation
  IF NOT normalized_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'error', 'Invalid email format'
    );
  END IF;
  
  -- Extract domain
  domain_part := SPLIT_PART(normalized_email, '@', 2);
  
  -- Check for temporary email domains
  IF domain_part = ANY(temp_domains) THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'error', 'Temporary email addresses are not allowed'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'normalized_email', normalized_email
  );
END;
$$;