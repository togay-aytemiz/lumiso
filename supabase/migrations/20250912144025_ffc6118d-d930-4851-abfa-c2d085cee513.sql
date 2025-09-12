-- Drop restrictive check constraints to allow extended role names like 'Photographer' and 'Manager'
-- This migration is idempotent and safe to run multiple times

-- 1) Invitations.role: remove CHECK constraint restricting role values
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check;

-- Ensure column is TEXT NOT NULL (keeps existing type if already text)
ALTER TABLE public.invitations
  ALTER COLUMN role SET NOT NULL;

-- 2) Organization members.role: remove CHECK constraint restricting role labels
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- Ensure column is TEXT (role label) and keep NOT NULL if already set
ALTER TABLE public.organization_members
  ALTER COLUMN role TYPE text;

-- 3) (Optional safety) Keep system_role enum unchanged; no action required here

-- 4) Comment for future maintainers
COMMENT ON COLUMN public.invitations.role IS 'Human-readable role label (e.g., Photographer, Manager, custom role name). Not to be confused with system_role enum.';
COMMENT ON COLUMN public.organization_members.role IS 'Assigned role label for display and routing. system_role controls core permissions; custom_role_id may refine permissions.';