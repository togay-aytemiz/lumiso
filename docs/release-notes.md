# Release Notes

## 2025-12-19
- Gallery bulk download now generates the .zip in the client (final galleries use originals; proof galleries use web conversions).
- Client download no longer depends on `gallery-download` or `gallery-download-processor`, removing the stuck "preparing" state.
- Rollout: deploy the updated client bundle; no Supabase function deployment required for this change.

## 2026-12-18
- Gallery bulk download uses async zip generation via `gallery-download-processor`, with storage-backed downloads for large files.
- Bulk download modal shows a ready state with retry and can be closed while preparing.
- Rollout: deploy `gallery-download` and `gallery-download-processor`, verify the cron job, and monitor `gallery-downloads` storage usage.
