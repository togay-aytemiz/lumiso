-- Invitations support migration
-- 1) Create audit log table
create table if not exists public.invitation_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  email text not null,
  success boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

-- Helpful index for rate-limiting lookups
create index if not exists idx_invitation_audit_log_user_org_created_at
  on public.invitation_audit_log (user_id, organization_id, created_at desc);

-- 2) Loosen validation to allow inviting existing users
create or replace function public.validate_invitation_email(email_param text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  normalized_email text;
  is_valid boolean := true;
  error_msg text := null;
begin
  normalized_email := lower(trim(email_param));

  if normalized_email is null or normalized_email = '' then
    is_valid := false;
    error_msg := 'Email is required';
  elsif normalized_email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' then
    is_valid := false;
    error_msg := 'Invalid email format';
  end if;

  -- Important: DO NOT block existing users; inviting an existing account is allowed
  return jsonb_build_object(
    'valid', is_valid,
    'normalized_email', normalized_email,
    'error', error_msg
  );
end;
$$;

-- 3) Rate limit check, based on audit log (10 per hour per org per user)
create or replace function public.check_invitation_rate_limit(user_uuid uuid, org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  invitation_count integer;
begin
  select count(*) into invitation_count
  from public.invitation_audit_log
  where user_id = user_uuid
    and organization_id = org_id
    and created_at > now() - interval '1 hour';

  return invitation_count < 10;
end;
$$;

-- 4) Log invitation attempt
create or replace function public.log_invitation_attempt(
  user_uuid uuid,
  email_param text,
  org_id uuid,
  success boolean,
  error_message text default null
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.invitation_audit_log (
    user_id,
    organization_id,
    email,
    success,
    error_message,
    created_at
  ) values (
    user_uuid,
    org_id,
    lower(trim(email_param)),
    success,
    error_message,
    now()
  );
end;
$$;