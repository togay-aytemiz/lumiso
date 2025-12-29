-- Reduce gallery download processor cron frequency to every 30 minutes.
do $$
begin
  perform cron.unschedule('gallery-download-processor-every-minute');
exception when others then
  null;
end $$;

select cron.schedule(
  'gallery-download-processor-every-minute',
  '*/30 * * * *',
  $$
  select net.http_post(
    url:='https://rifdykpdubrowzbylffe.supabase.co/functions/v1/gallery-download-processor',
    headers:=jsonb_build_object(
      'Content-Type',
      'application/json',
      'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3OTc5NDMsImV4cCI6MjA2OTM3Mzk0M30.lhSbTbVWckd9zsT0hRCAO06nPKszZpKNi_sq6-WPmV8',
      'x-gallery-download-processor-secret',
      coalesce(public.get_vault_secret('gallery_download_processor_secret'), '')
    ),
    body:='{"action": "tick"}'::jsonb
  ) as request_id;
  $$
);
