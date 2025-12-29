-- Per-organization gallery storage limit (bytes)
-- Default: 3 GB

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS gallery_storage_limit_bytes bigint NOT NULL DEFAULT 3221225472;

COMMENT ON COLUMN public.organizations.gallery_storage_limit_bytes IS 'Max allowed gallery storage (bytes) for this organization.';

