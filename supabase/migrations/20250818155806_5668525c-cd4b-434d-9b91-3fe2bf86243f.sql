-- Fix the organization_members table to allow NULL user_id for pending invitations
-- and update the trigger to handle this properly

-- First, allow user_id to be NULL for pending memberships
ALTER TABLE organization_members ALTER COLUMN user_id DROP NOT NULL;

-- Update the handle_invitation_created trigger to not insert user_id as NULL
DROP TRIGGER IF EXISTS on_invitation_created ON invitations;
DROP FUNCTION IF EXISTS handle_invitation_created();

-- Create a simplified trigger that doesn't create pending memberships
-- The invitation signup process will handle membership creation directly
CREATE OR REPLACE FUNCTION public.handle_invitation_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Just log the invitation creation, don't create pending memberships
  -- The membership will be created when the user accepts the invitation
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_invitation_created
  AFTER INSERT ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_invitation_created();