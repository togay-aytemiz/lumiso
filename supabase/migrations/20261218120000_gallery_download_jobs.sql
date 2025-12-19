-- Gallery bulk download jobs (async zip)

-- Table to track download job status and TTL
create table if not exists public.gallery_download_jobs (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  viewer_id uuid not null,
  status text not null default 'pending',
  gallery_type text not null,
  asset_variant text not null,
  asset_count integer not null default 0,
  assets_updated_at timestamptz,
  storage_path text,
  error_message text,
  processing_started_at timestamptz,
  ready_at timestamptz,
  failed_at timestamptz,
  expired_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_download_jobs_status_check
    check (status in ('pending', 'processing', 'ready', 'failed', 'expired')),
  constraint gallery_download_jobs_variant_check
    check (asset_variant in ('web', 'original'))
);

create index if not exists gallery_download_jobs_gallery_id_idx
  on public.gallery_download_jobs (gallery_id);

create index if not exists gallery_download_jobs_status_idx
  on public.gallery_download_jobs (status, created_at desc);

create index if not exists gallery_download_jobs_expires_at_idx
  on public.gallery_download_jobs (expires_at);

create trigger update_gallery_download_jobs_updated_at
  before update on public.gallery_download_jobs
  for each row execute function public.update_updated_at_column();

alter table public.gallery_download_jobs enable row level security;

-- Owners can read download jobs for their galleries
drop policy if exists "Organization owners can read gallery download jobs" on public.gallery_download_jobs;
create policy "Organization owners can read gallery download jobs"
  on public.gallery_download_jobs
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

-- Gallery viewers can read download jobs when they have a valid grant
drop policy if exists "Gallery viewers can read gallery download jobs" on public.gallery_download_jobs;
create policy "Gallery viewers can read gallery download jobs"
  on public.gallery_download_jobs
  for select
  using (
    exists (
      select 1
      from public.gallery_access_grants gag
      where gag.gallery_id = gallery_download_jobs.gallery_id
        and gag.viewer_id = auth.uid()
        and gag.expires_at > now()
    )
  );

-- Private bucket for generated zip downloads
insert into storage.buckets (id, name, public)
values ('gallery-downloads', 'gallery-downloads', false)
on conflict (id) do nothing;

-- Schedule background processing + cleanup
select cron.unschedule('gallery-download-processor-every-minute');

select cron.schedule(
  'gallery-download-processor-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url:='https://rifdykpdubrowzbylffe.supabase.co/functions/v1/gallery-download-processor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8"}'::jsonb,
    body:='{"action": "tick"}'::jsonb
  ) as request_id;
  $$
);
