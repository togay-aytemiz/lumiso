# Release Notes

## 2025-12-20
- Reduced duplicate organization and organization_settings fetches by caching org detail lookups, reusing org ids from local storage, and treating missing settings as a cache hit.
- Organization realtime updates now refresh local caches directly, and template variables reuse cached org settings/lead fields to avoid extra fetches.
- Added throttles for org/org_settings refreshes and disabled background polling for org settings.
- Edge messaging guard caches org membership checks to cut repeated service_role lookups.
- Daily summary scheduler now batches org/org_settings lookups and only runs guard/email work when the scheduled time matches.
- Rollout: deploy the updated client bundle and re-deploy Edge functions (messaging guard + daily summary scheduler).

## 2025-12-19
- Gallery bulk download now generates the .zip in the client (final galleries use originals; proof galleries use web conversions).
- Client download no longer depends on `gallery-download` or `gallery-download-processor`, removing the stuck "preparing" state.
- Bulk download preparation can be canceled without surfacing an error state.
- Gallery list now switches between All/Selection/Final views with contextual status filters and table columns.
- Gallery list table header now keeps the title + count on the left, with the status segment placed just before the search input.
- Final delivery downloads are tracked so lists can show a Downloaded status and last action, with size/time rows staying blank until an expiration date is set.
- Gallery list actions now include Archive/Delete confirmations, and archived items are restricted to the Archive segment.
- All galleries view now shows size in its own column, leaving summary empty for final galleries.
- All galleries view now orders columns as Last action → Size & time remaining → Actions.
- Selection progress now counts per required rule, even when the same photo is used across multiple required selections.
- Rollout: deploy the updated client bundle; no Supabase function deployment required for this change.
- Rollout (DB): apply `supabase/migrations/20261219110000_gallery_download_events.sql`.

## 2026-12-18
- Gallery bulk download uses async zip generation via `gallery-download-processor`, with storage-backed downloads for large files.
- Bulk download modal shows a ready state with retry and can be closed while preparing.
- Rollout: deploy `gallery-download` and `gallery-download-processor`, verify the cron job, and monitor `gallery-downloads` storage usage.
