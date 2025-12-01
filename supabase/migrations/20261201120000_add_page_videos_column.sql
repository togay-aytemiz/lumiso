-- Add page_videos JSONB column to store per-page video prompt status
alter table public.user_settings
  add column if not exists page_videos jsonb;

-- Ensure existing rows have an empty object and set default
update public.user_settings
  set page_videos = '{}'::jsonb
  where page_videos is null;

alter table public.user_settings
  alter column page_videos set default '{}'::jsonb;

-- Optional: enforce not null for consistency
alter table public.user_settings
  alter column page_videos set not null;
