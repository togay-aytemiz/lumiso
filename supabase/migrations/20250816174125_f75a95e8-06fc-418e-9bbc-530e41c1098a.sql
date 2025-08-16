-- First drop all existing policies for organization_members
DROP POLICY IF EXISTS "Users can view their own membership" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can view all members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can insert members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can delete members" ON public.organization_members;

-- Drop any other existing policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'organization_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
    END LOOP;
END
$$;

-- Create new non-recursive policies
CREATE POLICY "Users can view their own membership" 
ON public.organization_members 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Organization owners can view all members" 
ON public.organization_members 
FOR SELECT 
USING (
  auth.uid() = organization_id  -- Owner's user_id equals organization_id
);

CREATE POLICY "Organization owners can insert members" 
ON public.organization_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = organization_id  -- Only organization owner can insert
  OR auth.uid() = user_id  -- Or user joining themselves
);

CREATE POLICY "Organization owners can update members" 
ON public.organization_members 
FOR UPDATE 
USING (auth.uid() = organization_id);

CREATE POLICY "Organization owners can delete members" 
ON public.organization_members 
FOR DELETE 
USING (
  auth.uid() = organization_id 
  AND user_id <> auth.uid()  -- Can't delete themselves
);