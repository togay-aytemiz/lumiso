-- Remove the legacy per-user lead status trigger now that lead statuses
-- are seeded per organization via handle_new_user_organization.
DROP TRIGGER IF EXISTS on_auth_user_created_lead_statuses ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_lead_statuses();
