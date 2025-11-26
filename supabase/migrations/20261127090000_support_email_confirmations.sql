-- Track and de‑duplicate support email confirmations per user + confirmation timestamp
create table if not exists public.support_email_confirmations (
  user_id uuid not null,
  confirmed_at timestamptz not null,
  email text,
  locale text,
  timezone text,
  sent_at timestamptz,
  provider_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  primary key (user_id, confirmed_at)
);

alter table public.support_email_confirmations enable row level security;

-- Restrict access to service role; edge functions run with service key
create policy "Service role can manage support confirmations"
  on public.support_email_confirmations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
