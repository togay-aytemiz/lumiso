-- Prevent duplicate pending invites per org+email (simplified)
CREATE UNIQUE INDEX IF NOT EXISTS invitations_unique_pending
ON public.invitations (organization_id, email)
WHERE accepted_at IS NULL;