-- First check if there are any pending memberships without proper roles
UPDATE organization_members 
SET role = 'Member' 
WHERE role IS NULL AND status = 'pending';

-- Now let's ensure the invitation signup process works by creating a proper trigger
-- that automatically creates a pending membership when an invitation is created
CREATE OR REPLACE FUNCTION public.handle_invitation_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create a pending membership record when an invitation is created
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    system_role,
    role,
    status,
    invited_by
  ) VALUES (
    NEW.organization_id,
    NULL, -- Will be set when user accepts
    'Member'::system_role,
    NEW.role,
    'pending',
    NEW.invited_by
  ) ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new invitations
DROP TRIGGER IF EXISTS on_invitation_created ON public.invitations;
CREATE TRIGGER on_invitation_created
  AFTER INSERT ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invitation_created();