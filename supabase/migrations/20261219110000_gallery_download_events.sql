-- Track gallery download events for delivery status

create table if not exists public.gallery_download_events (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  viewer_id uuid not null,
  downloaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists gallery_download_events_gallery_id_idx
  on public.gallery_download_events (gallery_id);

create index if not exists gallery_download_events_downloaded_at_idx
  on public.gallery_download_events (downloaded_at desc);

alter table public.gallery_download_events enable row level security;

-- Owners can read download events for their galleries
drop policy if exists "Organization owners can read gallery download events" on public.gallery_download_events;
create policy "Organization owners can read gallery download events"
  on public.gallery_download_events
  for select
  using (
    gallery_id in (
      select g.id
      from public.galleries g
      join public.sessions s on s.id = g.session_id
      where s.organization_id in (
        select id from public.organizations where owner_id = auth.uid()
      )
    )
  );

-- Owners can insert download events for their galleries
drop policy if exists "Organization owners can insert gallery download events" on public.gallery_download_events;
create policy "Organization owners can insert gallery download events"
  on public.gallery_download_events
  for insert
  with check (
    gallery_id in (
      select g.id
      from public.galleries g
      join public.sessions s on s.id = g.session_id
      where s.organization_id in (
        select id from public.organizations where owner_id = auth.uid()
      )
    )
  );

-- Gallery viewers can read their own download events
drop policy if exists "Gallery viewers can read their download events" on public.gallery_download_events;
create policy "Gallery viewers can read their download events"
  on public.gallery_download_events
  for select
  using (
    viewer_id = auth.uid()
    and exists (
      select 1
      from public.gallery_access_grants gag
      where gag.gallery_id = gallery_download_events.gallery_id
        and gag.viewer_id = auth.uid()
        and gag.expires_at > now()
    )
  );

-- Gallery viewers can insert download events when they have access
drop policy if exists "Gallery viewers can insert gallery download events" on public.gallery_download_events;
create policy "Gallery viewers can insert gallery download events"
  on public.gallery_download_events
  for insert
  with check (
    viewer_id = auth.uid()
    and exists (
      select 1
      from public.gallery_access_grants gag
      where gag.gallery_id = gallery_download_events.gallery_id
        and gag.viewer_id = auth.uid()
        and gag.expires_at > now()
    )
  );
