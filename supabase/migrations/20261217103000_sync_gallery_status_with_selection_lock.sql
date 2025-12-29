-- Keep gallery.status in sync with client selection lock state.
-- - When selections are locked, mark the gallery as approved (unless archived).
-- - When selections are reopened, revert approved galleries back to published.

create or replace function public.sync_gallery_status_with_selection_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_locked = true then
      update public.galleries
      set status = 'approved'
      where id = new.gallery_id
        and status in ('published', 'approved');
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.is_locked is distinct from new.is_locked then
      if new.is_locked = true then
        update public.galleries
        set status = 'approved'
        where id = new.gallery_id
          and status in ('published', 'approved');
      else
        update public.galleries
        set status = 'published'
        where id = new.gallery_id
          and status = 'approved';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_gallery_status_with_selection_lock on public.gallery_selection_states;
create trigger trg_sync_gallery_status_with_selection_lock
after insert or update of is_locked on public.gallery_selection_states
for each row
execute function public.sync_gallery_status_with_selection_lock();

