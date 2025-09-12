-- Add missing project policies only
-- Check and create only non-existing policies

-- Add policy for assigned projects viewing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' 
    AND policyname = 'Users can view assigned projects with permission'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view assigned projects with permission" 
    ON public.projects FOR SELECT
    USING (
      organization_id = get_user_active_organization_id() AND
      user_has_permission(auth.uid(), ''view_assigned_projects'') AND (
        auth.uid() = ANY(assignees) OR auth.uid() = user_id
      )
    )';
  END IF;
END $$;

-- Add policy for assigned projects editing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' 
    AND policyname = 'Users can update assigned projects with edit permission'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update assigned projects with edit permission" 
    ON public.projects FOR UPDATE
    USING (
      organization_id = get_user_active_organization_id() AND
      user_has_permission(auth.uid(), ''edit_assigned_projects'') AND (
        auth.uid() = ANY(assignees) OR auth.uid() = user_id
      )
    )';
  END IF;
END $$;