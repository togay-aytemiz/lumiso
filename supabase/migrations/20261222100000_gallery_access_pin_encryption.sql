-- Encrypt gallery PINs at rest and expose via RPC for owners

create extension if not exists pgcrypto;

alter table public.gallery_access add column if not exists pin_encrypted text;
alter table public.gallery_access alter column pin drop not null;

drop index if exists public.gallery_access_pin_unique;

create or replace function public.get_vault_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text;
begin
  if secret_name is null or length(secret_name) = 0 then
    return null;
  end if;

  result := null;

  begin
    execute 'select vault.read_secret($1)' into result using secret_name;
  exception when others then
    result := null;
  end;

  if result is not null then
    return result;
  end if;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into result using secret_name;
  exception when others then
    result := null;
  end;

  if result is not null then
    return result;
  end if;

  begin
    execute 'select secret from vault.decrypted_secrets where name = $1' into result using secret_name;
  exception when others then
    result := null;
  end;

  return result;
end;
$$;

revoke execute on function public.get_vault_secret(text) from public;
grant execute on function public.get_vault_secret(text) to service_role;

create or replace function public.encrypt_gallery_pin(input_pin text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text := public.get_vault_secret('gallery_pin_key');
begin
  if input_pin is null or length(input_pin) = 0 then
    return null;
  end if;
  if secret is null or length(secret) = 0 then
    return null;
  end if;
  return encode(extensions.pgp_sym_encrypt(input_pin, secret, 'compress-algo=1, cipher-algo=aes256'), 'base64');
end;
$$;

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
    join public.sessions s on s.id = g.session_id
    join public.organizations o on o.id = s.organization_id
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

create or replace function public.create_gallery_access_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  encrypted_pin text;
begin
  if NEW.id is null then
    return NEW;
  end if;

  if exists (select 1 from public.gallery_access where gallery_id = NEW.id) then
    return NEW;
  end if;

  loop
    candidate := public.generate_gallery_pin();
    encrypted_pin := public.encrypt_gallery_pin(candidate);
    begin
      insert into public.gallery_access (gallery_id, pin, pin_hash, pin_encrypted)
      values (
        NEW.id,
        case when encrypted_pin is null then candidate else null end,
        extensions.crypt(candidate, extensions.gen_salt('bf')),
        encrypted_pin
      );
      exit;
    exception when unique_violation then
      -- Collision on pin: retry.
    end;
  end loop;

  return NEW;
end;
$$;

do $$
declare
  secret text := public.get_vault_secret('gallery_pin_key');
begin
  if secret is not null and length(secret) > 0 then
    update public.gallery_access
    set pin_encrypted = coalesce(
      pin_encrypted,
      encode(extensions.pgp_sym_encrypt(pin, secret, 'compress-algo=1, cipher-algo=aes256'), 'base64')
    ),
    pin = null
    where pin is not null;
  end if;
end;
$$;
