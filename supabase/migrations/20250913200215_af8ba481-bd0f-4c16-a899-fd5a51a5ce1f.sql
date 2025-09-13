-- Remove team management tables and functions for single photographer mode

-- Drop team-related tables if they exist
DROP TABLE IF EXISTS public.team_members;
DROP TABLE IF EXISTS public.team_invitations;
DROP TABLE IF EXISTS public.user_roles;

-- Drop team-related functions if they exist
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role text);
DROP FUNCTION IF EXISTS public.accept_team_invitation(invitation_id uuid);
DROP FUNCTION IF EXISTS public.send_team_invitation(email text, role text);

-- Drop team-related RLS policies (they will be dropped automatically when tables are dropped)

-- Remove any team-related columns from existing tables
ALTER TABLE public.leads DROP COLUMN IF EXISTS assignees;
ALTER TABLE public.projects DROP COLUMN IF EXISTS assignees;

-- Drop team-related enums if they exist
DROP TYPE IF EXISTS public.app_role;
DROP TYPE IF EXISTS public.team_role;