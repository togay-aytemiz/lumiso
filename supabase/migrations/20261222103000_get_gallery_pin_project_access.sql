-- Allow get_gallery_pin to validate ownership for project-based galleries too.
create or replace function public.get_gallery_pin(gallery_uuid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text := public.get_vault_secret('gallery_pin_key');
  encrypted_pin text;
  plain_pin text;
begin
  if gallery_uuid is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.galleries g
    left join public.sessions s on s.id = g.session_id
    left join public.projects p on p.id = g.project_id
    left join public.organizations o on o.id = coalesce(s.organization_id, p.organization_id)
    where g.id = gallery_uuid
      and o.owner_id = auth.uid()
  ) then
    return null;
  end if;

  select pin_encrypted, pin
    into encrypted_pin, plain_pin
    from public.gallery_access
    where gallery_id = gallery_uuid;

  if encrypted_pin is not null and secret is not null and length(secret) > 0 then
    return convert_from(extensions.pgp_sym_decrypt(decode(encrypted_pin, 'base64'), secret), 'utf8');
  end if;

  return plain_pin;
end;
$$;

revoke execute on function public.get_gallery_pin(uuid) from public;
grant execute on function public.get_gallery_pin(uuid) to authenticated, service_role;
