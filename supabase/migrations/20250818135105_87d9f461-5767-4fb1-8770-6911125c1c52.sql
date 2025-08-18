-- Test the get_user_organization_id function and RLS policies
-- First, let's check what organization ID the new user gets
SELECT public.get_user_organization_id() as user_org_id;

-- Also check if the user exists in organization_members
SELECT 
  om.organization_id,
  om.user_id,
  om.role,
  auth.uid() as current_user_id
FROM organization_members om 
WHERE om.user_id = auth.uid();

-- Test the RLS policy logic directly
SELECT 
  leads.id,
  leads.name,
  leads.user_id as lead_owner,
  auth.uid() as current_user,
  (leads.user_id IN (
    SELECT organization_members.user_id
    FROM organization_members
    WHERE organization_members.organization_id = public.get_user_organization_id()
  )) as should_see_lead
FROM leads 
LIMIT 3;