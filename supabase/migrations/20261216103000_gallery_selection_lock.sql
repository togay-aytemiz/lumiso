-- Persisted selection lock state for proof galleries
-- - Adds gallery_selection_states table (per-gallery lock + optional note)
-- - Enforces lock at the DB layer by restricting client_selections mutations when locked

create table if not exists public.gallery_selection_states (
  gallery_id uuid primary key references public.galleries(id) on delete cascade,
  is_locked boolean not null default false,
  note text,
  locked_at timestamptz,
  locked_by uuid,
  unlocked_at timestamptz,
  unlocked_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists gallery_selection_states_is_locked_idx
on public.gallery_selection_states (is_locked);

alter table public.gallery_selection_states enable row level security;

drop policy if exists "Organization owners can manage gallery selection states" on public.gallery_selection_states;
create policy "Organization owners can manage gallery selection states"
on public.gallery_selection_states
for all
using (
  gallery_id in (
    select g.id
    from public.galleries g
    join public.sessions s on s.id = g.session_id
    where s.organization_id in (
      select id from public.organizations where owner_id = auth.uid()
    )
  )
)
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

drop policy if exists "Gallery viewers can view gallery selection states" on public.gallery_selection_states;
create policy "Gallery viewers can view gallery selection states"
on public.gallery_selection_states
for select
using (
  exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = gallery_selection_states.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
);

drop policy if exists "Gallery viewers can insert gallery selection states" on public.gallery_selection_states;
create policy "Gallery viewers can insert gallery selection states"
on public.gallery_selection_states
for insert
with check (
  exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = gallery_selection_states.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
);

drop policy if exists "Gallery viewers can update gallery selection states" on public.gallery_selection_states;
create policy "Gallery viewers can update gallery selection states"
on public.gallery_selection_states
for update
using (
  exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = gallery_selection_states.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
)
with check (
  exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = gallery_selection_states.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
);

-- Enforce selection lock for client selections
-- - Keep read access intact (owners can view; viewers can view their selections)
-- - Block inserts/updates/deletes when gallery_selection_states.is_locked = true

drop policy if exists "Organization owners can manage client selections" on public.client_selections;

drop policy if exists "Organization owners can view client selections" on public.client_selections;
create policy "Organization owners can view client selections"
on public.client_selections
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

drop policy if exists "Organization owners can insert client selections when unlocked" on public.client_selections;
create policy "Organization owners can insert client selections when unlocked"
on public.client_selections
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
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
);

drop policy if exists "Organization owners can update client selections when unlocked" on public.client_selections;
create policy "Organization owners can update client selections when unlocked"
on public.client_selections
for update
using (
  gallery_id in (
    select g.id
    from public.galleries g
    join public.sessions s on s.id = g.session_id
    where s.organization_id in (
      select id from public.organizations where owner_id = auth.uid()
    )
  )
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
)
with check (
  gallery_id in (
    select g.id
    from public.galleries g
    join public.sessions s on s.id = g.session_id
    where s.organization_id in (
      select id from public.organizations where owner_id = auth.uid()
    )
  )
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
);

drop policy if exists "Organization owners can delete client selections when unlocked" on public.client_selections;
create policy "Organization owners can delete client selections when unlocked"
on public.client_selections
for delete
using (
  gallery_id in (
    select g.id
    from public.galleries g
    join public.sessions s on s.id = g.session_id
    where s.organization_id in (
      select id from public.organizations where owner_id = auth.uid()
    )
  )
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
);

-- Update viewer mutation policies to respect lock state
drop policy if exists "Gallery viewers can insert client selections" on public.client_selections;
create policy "Gallery viewers can insert client selections"
on public.client_selections
for insert
with check (
  client_id = auth.uid()
  and exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = client_selections.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
);

drop policy if exists "Gallery viewers can update client selections" on public.client_selections;
create policy "Gallery viewers can update client selections"
on public.client_selections
for update
using (
  client_id = auth.uid()
  and exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = client_selections.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
)
with check (
  client_id = auth.uid()
  and exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = client_selections.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
);

drop policy if exists "Gallery viewers can delete client selections" on public.client_selections;
create policy "Gallery viewers can delete client selections"
on public.client_selections
for delete
using (
  client_id = auth.uid()
  and exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = client_selections.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
  and not exists (
    select 1
    from public.gallery_selection_states gss
    where gss.gallery_id = client_selections.gallery_id
      and gss.is_locked = true
  )
);

