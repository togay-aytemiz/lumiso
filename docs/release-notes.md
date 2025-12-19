# Release Notes

## 2026-12-18
- Switched gallery bulk download to on-demand zip streaming via `gallery-download-stream` (no temp zip storage).
- Rollout: deploy the `gallery-download-stream` Edge function and monitor download latency for large galleries.
