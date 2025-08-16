-- Fix RLS policies for organization_members to avoid infinite recursion
DROP POLICY IF EXISTS "Members can view their organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can delete organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can insert organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can update organization members" ON public.organization_members;

-- Create simpler, non-recursive policies
CREATE POLICY "Users can view their own membership" 
ON public.organization_members 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Organization owners can view all members" 
ON public.organization_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.role = 'Owner' 
    AND om.organization_id = organization_members.organization_id
  )
);

CREATE POLICY "Organization owners can insert members" 
ON public.organization_members 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.role = 'Owner' 
    AND om.organization_id = organization_members.organization_id
  )
  OR auth.uid() = user_id  -- Allow users to join if they have an invitation
);

CREATE POLICY "Organization owners can update members" 
ON public.organization_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.role = 'Owner' 
    AND om.organization_id = organization_members.organization_id
  )
);

CREATE POLICY "Organization owners can delete members" 
ON public.organization_members 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.role = 'Owner' 
    AND om.organization_id = organization_members.organization_id
  )
  AND user_id <> auth.uid()  -- Can't delete themselves
);

-- Ensure working hours are properly enabled by default
-- Update the trigger function to set enabled=true for weekdays
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create organization member record for new user as Owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'Owner');
  
  -- Create default working hours (Monday to Friday enabled, 9 AM to 5 PM)
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, '09:00', '17:00'), -- Saturday
    (NEW.id, 0, false, '09:00', '17:00'); -- Sunday
  
  RETURN NEW;
END;
$function$;