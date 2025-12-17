-- Extend gallery status values and support archive/restore by remembering the previous status.

alter table if exists public.galleries
  add column if not exists previous_status text;

alter table public.galleries
  drop constraint if exists galleries_status_check;

alter table public.galleries
  add constraint galleries_status_check
  check (status in ('draft', 'published', 'approved', 'archived'));

alter table public.galleries
  drop constraint if exists galleries_previous_status_check;

alter table public.galleries
  add constraint galleries_previous_status_check
  check (previous_status is null or previous_status in ('draft', 'published', 'approved'));

update public.galleries
set previous_status = case when published_at is null then 'draft' else 'published' end
where status = 'archived'
  and previous_status is null;

