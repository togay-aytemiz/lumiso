-- Clean up all the old conflicting cron jobs and keep only the new simple one
SELECT cron.unschedule('daily-notifications-7am');
SELECT cron.unschedule('daily-notifications-processor');  
SELECT cron.unschedule('process-daily-summaries');
SELECT cron.unschedule('process-pending-notifications');
SELECT cron.unschedule('process-scheduled-notifications'); 
SELECT cron.unschedule('schedule-daily-summaries');
SELECT cron.unschedule('retry-failed-notifications');

-- Keep only our new simplified notification checker
-- The daily-notification-checker should already exist from previous migration