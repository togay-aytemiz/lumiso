create table if not exists public.membership_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  admin_id uuid,
  action text not null,
  metadata jsonb,
  previous_status text,
  new_status text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists membership_events_organization_id_idx
  on public.membership_events (organization_id, created_at desc);
