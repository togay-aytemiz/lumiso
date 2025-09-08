-- Remove the remaining old notification processor
SELECT cron.unschedule('notification-processor-every-2-minutes');