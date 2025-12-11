-- Core tables for galleries, assets, and client selections (additive, backward compatible)
create table if not exists public.galleries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  type text not null default 'proof' check (type in ('proof','retouch','final','other')),
  title text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  pin_hash text,
  expires_at timestamptz,
  watermark_settings jsonb,
  branding jsonb,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists galleries_session_id_idx on public.galleries (session_id);
create index if not exists galleries_project_id_idx on public.galleries (project_id);

create table if not exists public.gallery_assets (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  storage_path_original text,
  storage_path_web text,
  width integer,
  height integer,
  content_hash text,
  order_index integer default 0,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists gallery_assets_gallery_id_idx on public.gallery_assets (gallery_id);
create index if not exists gallery_assets_status_idx on public.gallery_assets (status);

create table if not exists public.client_selections (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  asset_id uuid references public.gallery_assets(id) on delete cascade,
  selection_part text,
  client_id uuid,
  client_email text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists client_selections_gallery_id_idx on public.client_selections (gallery_id);
create index if not exists client_selections_asset_id_idx on public.client_selections (asset_id);
