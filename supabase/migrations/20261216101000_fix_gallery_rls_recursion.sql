-- Fix infinite recursion between galleries and gallery_access_grants policies
-- The galleries RLS policy checks gallery_access_grants; if gallery_access_grants policy
-- also queries galleries, Postgres detects recursion and blocks queries.

drop policy if exists "Organization owners can read gallery access grants" on public.gallery_access_grants;

