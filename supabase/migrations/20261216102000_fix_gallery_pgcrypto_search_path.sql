-- Fix gallery creation failure when pgcrypto is installed in the `extensions` schema.
-- Some SECURITY DEFINER functions run with `search_path = public`, which prevents
-- unqualified pgcrypto calls (e.g. gen_random_bytes/crypt/gen_salt) from resolving.

create extension if not exists pgcrypto;

create or replace function public.generate_gallery_public_id()
returns text
language plpgsql
set search_path = public, extensions
as $$
begin
  -- 16 chars, URL-safe (0-9A-F)
  return upper(encode(gen_random_bytes(8), 'hex'));
end;
$$;

create or replace function public.generate_gallery_pin()
returns text
language plpgsql
set search_path = public, extensions
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
set search_path = public, extensions
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

