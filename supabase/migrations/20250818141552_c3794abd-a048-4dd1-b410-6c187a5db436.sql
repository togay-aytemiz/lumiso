-- Temporarily create test policies that don't rely on auth.uid() to verify organization sharing works
-- This is for debugging only

-- Test policy for leads
DROP POLICY IF EXISTS "Test - Organization members can view leads" ON leads;
CREATE POLICY "Test - Organization members can view leads"
ON leads
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM organization_members 
    WHERE organization_id = 'ac32273e-af95-4de9-abed-ce96e6f68139'
  )
);

-- Test policy for projects  
DROP POLICY IF EXISTS "Test - Organization members can view projects" ON projects;
CREATE POLICY "Test - Organization members can view projects"
ON projects
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM organization_members 
    WHERE organization_id = 'ac32273e-af95-4de9-abed-ce96e6f68139'
  )
);

-- Test policy for sessions
DROP POLICY IF EXISTS "Test - Organization members can view sessions" ON sessions;
CREATE POLICY "Test - Organization members can view sessions"
ON sessions  
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM organization_members 
    WHERE organization_id = 'ac32273e-af95-4de9-abed-ce96e6f68139'
  )
);

-- Test policy for activities
DROP POLICY IF EXISTS "Test - Organization members can view activities" ON activities;
CREATE POLICY "Test - Organization members can view activities"
ON activities
FOR SELECT  
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM organization_members 
    WHERE organization_id = 'ac32273e-af95-4de9-abed-ce96e6f68139'
  )
);