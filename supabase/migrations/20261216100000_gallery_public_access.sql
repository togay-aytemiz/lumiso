-- Public gallery access (public link + system PIN) with viewer grants
-- - Adds galleries.public_id (public share token)
-- - Creates gallery_access (PIN storage) and gallery_access_grants (viewer sessions)
-- - Enables RLS policies for owners and granted viewers

create extension if not exists pgcrypto;

alter table public.galleries add column if not exists public_id text;

create unique index if not exists galleries_public_id_unique on public.galleries (public_id);

create or replace function public.generate_gallery_public_id()
returns text
language plpgsql
as $$
begin
  -- 16 chars, URL-safe (0-9A-F)
  return upper(encode(gen_random_bytes(8), 'hex'));
end;
$$;

-- Only affects future inserts; existing rows keep null.
alter table public.galleries alter column public_id set default public.generate_gallery_public_id();

create table if not exists public.gallery_access (
  gallery_id uuid primary key references public.galleries(id) on delete cascade,
  pin text not null,
  pin_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists gallery_access_pin_unique on public.gallery_access (pin);

create or replace function public.generate_gallery_pin()
returns text
language plpgsql
as $$
declare
  -- Avoid ambiguous characters (I, L, O) while keeping digits + uppercase letters.
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  i int;
  byte_value int;
begin
  for i in 1..6 loop
    byte_value := get_byte(gen_random_bytes(1), 0);
    result := result || substr(alphabet, (byte_value % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_gallery_access_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  if NEW.id is null then
    return NEW;
  end if;

  if exists (select 1 from public.gallery_access where gallery_id = NEW.id) then
    return NEW;
  end if;

  loop
    candidate := public.generate_gallery_pin();
    begin
      insert into public.gallery_access (gallery_id, pin, pin_hash)
      values (NEW.id, candidate, crypt(candidate, gen_salt('bf')));
      exit;
    exception when unique_violation then
      -- Collision on pin: retry.
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_gallery_access_create on public.galleries;
create trigger trg_gallery_access_create
after insert on public.galleries
for each row
execute function public.create_gallery_access_on_insert();

create table if not exists public.gallery_access_grants (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  viewer_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists gallery_access_grants_gallery_viewer_unique
on public.gallery_access_grants (gallery_id, viewer_id);

create index if not exists gallery_access_grants_gallery_id_idx on public.gallery_access_grants (gallery_id);
create index if not exists gallery_access_grants_viewer_id_idx on public.gallery_access_grants (viewer_id);

-- RLS: galleries + related tables
alter table public.galleries enable row level security;
alter table public.gallery_sets enable row level security;
alter table public.gallery_assets enable row level security;
alter table public.client_selections enable row level security;
alter table public.gallery_access enable row level security;
alter table public.gallery_access_grants enable row level security;

drop policy if exists "Organization owners can manage galleries" on public.galleries;
create policy "Organization owners can manage galleries"
on public.galleries
for all
using (
  session_id in (
    select id
    from public.sessions
    where organization_id in (
      select id from public.organizations where owner_id = auth.uid()
    )
  )
)
with check (
  session_id in (
    select id
    from public.sessions
    where organization_id in (
      select id from public.organizations where owner_id = auth.uid()
    )
  )
);

drop policy if exists "Gallery viewers can view galleries" on public.galleries;
create policy "Gallery viewers can view galleries"
on public.galleries
for select
using (
  exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = galleries.id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
);

drop policy if exists "Organization owners can manage gallery sets" on public.gallery_sets;
create policy "Organization owners can manage gallery sets"
on public.gallery_sets
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

drop policy if exists "Gallery viewers can view gallery sets" on public.gallery_sets;
create policy "Gallery viewers can view gallery sets"
on public.gallery_sets
for select
using (
  exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = gallery_sets.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
);

drop policy if exists "Organization owners can manage gallery assets" on public.gallery_assets;
create policy "Organization owners can manage gallery assets"
on public.gallery_assets
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

drop policy if exists "Gallery viewers can view gallery assets" on public.gallery_assets;
create policy "Gallery viewers can view gallery assets"
on public.gallery_assets
for select
using (
  exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = gallery_assets.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
);

drop policy if exists "Organization owners can manage client selections" on public.client_selections;
create policy "Organization owners can manage client selections"
on public.client_selections
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

drop policy if exists "Gallery viewers can view their client selections" on public.client_selections;
create policy "Gallery viewers can view their client selections"
on public.client_selections
for select
using (
  client_id = auth.uid()
  and exists (
    select 1
    from public.gallery_access_grants gag
    where gag.gallery_id = client_selections.gallery_id
      and gag.viewer_id = auth.uid()
      and gag.expires_at > now()
  )
);

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
);

drop policy if exists "Organization owners can read gallery access" on public.gallery_access;
create policy "Organization owners can read gallery access"
on public.gallery_access
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

drop policy if exists "Organization owners can read gallery access grants" on public.gallery_access_grants;
create policy "Organization owners can read gallery access grants"
on public.gallery_access_grants
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

drop policy if exists "Gallery viewers can read their access grants" on public.gallery_access_grants;
create policy "Gallery viewers can read their access grants"
on public.gallery_access_grants
for select
using (viewer_id = auth.uid() and expires_at > now());

-- Storage: allow viewers with a valid grant to read gallery-assets objects.
drop policy if exists "Gallery viewers can view gallery assets" on storage.objects;
create policy "Gallery viewers can view gallery assets"
on storage.objects
for select
using (
  bucket_id = 'gallery-assets'
  and auth.uid() is not null
  and exists (
    select 1
    from public.gallery_access_grants gag
    where gag.viewer_id = auth.uid()
      and gag.expires_at > now()
      and gag.gallery_id::text = (storage.foldername(name))[3]
  )
);

