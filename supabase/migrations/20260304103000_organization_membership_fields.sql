-- Membership lifecycle fields for organizations
alter table public.organizations
  add column if not exists membership_status text not null default 'trial',
  add column if not exists trial_started_at timestamptz not null default timezone('utc', now()),
  add column if not exists trial_expires_at timestamptz not null default timezone('utc', now()) + interval '14 days',
  add column if not exists trial_extended_by_days integer not null default 0,
  add column if not exists trial_extension_reason text,
  add column if not exists premium_activated_at timestamptz,
  add column if not exists premium_plan text,
  add column if not exists premium_expires_at timestamptz,
  add column if not exists manual_flag boolean not null default false,
  add column if not exists manual_flag_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_membership_status_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_membership_status_check
      check (membership_status in ('trial', 'premium', 'expired', 'suspended', 'complimentary'));
  end if;
end $$;

update public.organizations
set
  trial_started_at = coalesce(trial_started_at, created_at),
  trial_expires_at = coalesce(trial_expires_at, created_at + interval '14 days')
where true;
