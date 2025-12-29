-- Allow organization owners to update client selections even while the gallery is locked.
-- This enables "unlock just for me" workflows where the client remains locked but the photographer can adjust picks.

drop policy if exists "Organization owners can view client selections" on public.client_selections;
drop policy if exists "Organization owners can insert client selections when unlocked" on public.client_selections;
drop policy if exists "Organization owners can update client selections when unlocked" on public.client_selections;
drop policy if exists "Organization owners can delete client selections when unlocked" on public.client_selections;
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

