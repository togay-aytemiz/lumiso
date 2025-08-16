-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create working hours table
CREATE TABLE public.working_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  enabled BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

-- Enable RLS on working hours
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

-- Create policies for working hours
CREATE POLICY "Users can view their own working hours" 
ON public.working_hours 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own working hours" 
ON public.working_hours 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own working hours" 
ON public.working_hours 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own working hours" 
ON public.working_hours 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create organization members table
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL, -- Will reference the owner's user_id initially
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Member')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Enable RLS on organization members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Create policies for organization members
CREATE POLICY "Members can view their organization members" 
ON public.organization_members 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert organization members" 
ON public.organization_members 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'Owner'
  )
  OR
  auth.uid() = user_id -- Allow self-insertion during signup
);

CREATE POLICY "Owners can update organization members" 
ON public.organization_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'Owner'
  )
  OR
  auth.uid() = user_id -- Allow updating own record
);

CREATE POLICY "Owners can delete organization members" 
ON public.organization_members 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'Owner'
  )
  AND user_id != auth.uid() -- Prevent owners from deleting themselves
);

-- Create invitations table
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Member')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for invitations
CREATE POLICY "Members can view their organization invitations" 
ON public.invitations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = invitations.organization_id 
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'Owner'
  )
);

CREATE POLICY "Owners can update invitations" 
ON public.invitations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = invitations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'Owner'
  )
);

CREATE POLICY "Owners can delete invitations" 
ON public.invitations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = invitations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'Owner'
  )
);

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);

-- Create storage policies for profile photos
CREATE POLICY "Profile photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photo" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile photo" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own profile photo" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_working_hours_updated_at
BEFORE UPDATE ON public.working_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create organization for new user
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create organization member record for new user as Owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'Owner');
  
  -- Create default working hours (Monday to Friday, 9 AM to 5 PM)
  INSERT INTO public.working_hours (user_id, day_of_week, enabled, start_time, end_time)
  VALUES 
    (NEW.id, 1, true, '09:00', '17:00'), -- Monday
    (NEW.id, 2, true, '09:00', '17:00'), -- Tuesday
    (NEW.id, 3, true, '09:00', '17:00'), -- Wednesday
    (NEW.id, 4, true, '09:00', '17:00'), -- Thursday
    (NEW.id, 5, true, '09:00', '17:00'), -- Friday
    (NEW.id, 6, false, null, null),     -- Saturday
    (NEW.id, 0, false, null, null);     -- Sunday
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user organization setup
CREATE TRIGGER on_auth_user_created_organization
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_organization();