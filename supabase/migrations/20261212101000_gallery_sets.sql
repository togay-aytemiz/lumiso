-- Gallery photo sets to group uploads within a gallery
create table if not exists public.gallery_sets (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  name text not null,
  description text,
  order_index integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists gallery_sets_gallery_id_idx on public.gallery_sets (gallery_id);
