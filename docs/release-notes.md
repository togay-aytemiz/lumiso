# Release Notes

## 2026-12-18
- Added async gallery bulk download that prepares a zip server-side with a 3-hour TTL.
- Added background processor + cleanup cron for generated gallery download zips.
- Rollout: deploy new Supabase Edge functions, verify cron job runs, and monitor `gallery-downloads` storage usage.
