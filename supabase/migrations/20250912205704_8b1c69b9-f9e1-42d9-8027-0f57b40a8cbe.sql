-- Add RLS policy to allow organization members to view each other's basic profile info
CREATE POLICY "Organization members can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (
  -- Allow if the requesting user is in the same organization as the profile owner
  EXISTS (
    SELECT 1 FROM public.organization_members om1
    JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om2.user_id = profiles.user_id
    AND om1.status = 'active' 
    AND om2.status = 'active'
  )
);