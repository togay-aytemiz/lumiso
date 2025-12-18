# Client Galleries & Proof Delivery — Phase Plan

## Purpose
- Ship a Phase 1 proofing + delivery flow that lets photographers upload, watermark, and share galleries per session, while capturing client selections for deliverables that require specific photo counts (albums, covers, prints).
- Keep scope lean but production-ready: async uploads, web-friendly proofs, PIN-protected client view, and a selection table photographers can configure or override.

## Current Snapshot (Lumiso)
- Session detail: gallery create sheet + per-session gallery list shipped; gallery detail supports uploads into sets (Supabase Storage proofs).
- Services: deliverable selection template UI shipped (EN/TR).
- Client view: `/galleries/:id/preview` (internal) + `/g/:publicId` (public) shipped with PIN gate, responsive desktop/mobile UI, selections/favorites, and watermark overlay.
- Supabase: tables + private `gallery-assets` bucket with org-scoped RLS shipped; public access uses `galleries.public_id` + `gallery_access` PIN + `gallery_access_grants` viewer sessions; admin tooling uses RPCs (`admin_list_galleries_with_storage`, `admin_grant_gallery_access`, `admin_set_gallery_archived`).
- Edge: Supabase functions (`gallery-access`, `gallery-branding`, `admin-gallery-delete`) + Netlify Edge Functions for share-link OG previews (`/g/*`, `/og/g/*`).
- Admin: Admin → Users → Gallery tab now shows per-gallery lead name + quick actions (preview, archive/restore with confirmation, delete with typed-name confirmation).

## Competitive Notes (Picflow, Pixpa, CloudSpot, ShootProof, Pixieset, SmugMug, Zenfolio, Lightfolio, N-Vu, Online Picture Proof)
- Client galleries with proof/final states, password/PIN, optional expiration, and share links per gallery.
- Favorites/ratings/shortlists, per-deliverable selection counters (e.g., “30 selects”, “1 cover”, “1 back cover”) and approval flows.
- Watermarks and download rules by gallery or collection (web-size proofs vs. full-res finals).
- Uploads that generate responsive, optimized images (WebP/JPEG fallback), background processing, and drag/drop ordering.
- Multiple galleries/collections per client/project (previews, retouch round, finals).
- Branded, minimal “client mode” with logo/name overlay and easy mobile navigation.
- Activity tracking (who viewed, what was favorited/downloaded) and reminder emails.
- Optional commerce (upsells, print store) — out of Phase 1.

## MVP Experience (Phase 1)
- From a session detail, photographer creates one or more galleries (proof, retouch, final) tied to that session; a Galleries page can list all galleries later.
- Uploads run async with background conversion to WebP (optional JPEG fallback) sized for proofing quality; **Phase 1 stores only converted proofs** (no originals).
- Optional watermark (logo or business name) per gallery; toggleable before publish.
- Client view secured by share link + PIN; lightweight branding (logo/name) and “client mode” layout.
- Client can select/favorite photos up to configured limits per deliverable requirement (album pages, cover, back cover, prints). Counts enforced and visible.
- Photographer sees selections inside the service/session context and can override/adjust before final delivery.

## Data Model v1 (current)
- `galleries`: `id`, `session_id`, `project_id`, `type` (`proof|retouch|final|other`), `title`, `status` (`draft|published|archived`), `public_id` (share token), `branding` (selection rules/settings, watermark config, coverAssetId, eventDate), timestamps, `published_at?`, `expires_at?`.
- `gallery_access`: `gallery_id`, `pin` (6 chars), `pin_hash`, timestamps. *(PIN is readable only by org owners; used by `gallery-access`.)*
- `gallery_access_grants`: `gallery_id`, `viewer_id` (`auth.uid()`), `expires_at`, timestamps. *(Issued after PIN check; used by RLS + Storage policies.)*
- `gallery_sets`: `id`, `gallery_id`, `name`, `description?`, `order_index`, timestamps.
- `gallery_assets`: `id`, `gallery_id`, `storage_path_web`, `storage_path_original?` (Phase 2), `width`, `height`, `content_hash`, `order_index`, `status` (`processing|ready|failed`), `metadata`, timestamps.
- `services.selection_template` (jsonb): rows like `{id, part, min, max, required}` for deliverable selection rules (copied onto `galleries.branding.selectionTemplateGroups`).
- `client_selections`: `id`, `gallery_id`, `asset_id`, `selection_part` (rule id or `"favorites"`), `client_id?` (viewer), timestamps. *(Owner overrides can be stored with `client_id` null.)*

### Example selection template (album)
| Service | Part | Min | Max | Required | Notes |
| --- | --- | --- | --- | --- | --- |
| Album 30x30 | Spread | 20 | 30 | Yes | Main pages |
| Album 30x30 | Cover | 1 | 1 | Yes | Front cover |
| Album 30x30 | Back cover | 1 | 1 | Yes | Rear cover |

Templates attach to services/packages; when a session includes that deliverable, the gallery auto-loads its selection rules. Photographer can edit per gallery.

## Configuring Services for Selection Counts (how the system knows “what/How many”)
- Where to store rules (current): use `services.selection_template` (jsonb) on deliverable-type services; when a gallery is created, copy into `galleries.branding.selectionTemplateGroups` + flattened `branding.selectionTemplate`.
- Shape to capture: `part` (Spread/Cover/Back cover/Print), `min`, `max`, `required` (bool), `notes`, optional `aspect_ratio` and `output_type` (e.g., `spread`, `single`, `cover`).
- Defaults and overrides:
  - **Service level**: define the template once per service (e.g., Album 30x30 → 30 spreads, 1 cover, 1 back cover).
  - **Package line-item level**: when a package contains that service, copy the template into the package payload so overrides (e.g., “Album 40x40” → 40 spreads) travel with the package.
  - **Session/gallery level**: when the project/session is created with those services, clone the template into the gallery config; the photographer can tweak counts before publishing.
- Runtime enforcement:
  - Client gallery reads the session-level template to render counters (remaining/selected) and blocks extra selections beyond `max`; required parts must be filled before submission/approval.
  - Photographer can override client picks (swap images or adjust counts) inside the session’s gallery admin view.
- Backward compatibility/migration:
  - Keep `services.selection_template` nullable; existing orgs stay untouched until enabled.
  - Rule IDs are persisted (`{id, part, ...}`) so renames don’t break existing `client_selections.selection_part` mappings.
  - Migration step: seed templates for existing deliverable services (albums, print packs, wall art) using sensible defaults; leave coverage-only services without templates.
- Example mappings:
  - “Album 30x30” → `{part: "Spread", min:20, max:30, required:true}`, `{part:"Cover", min:1, max:1, required:true}`, `{part:"Back cover", min:1, max:1, required:true}`
  - “10 Fine Art Prints” → `{part:"Print", min:10, max:10, required:true}`
  - “Canvas Trio” → `{part:"Canvas", min:3, max:3, required:true, aspect_ratio:"4:5"}`

## Phase Breakdown & Checklists

### Phase 0 — Design & Contract (1 week)
- [x] Finalize gallery types/states (proof, retouch, final) and copy (EN/TR).
- [x] Approve data model (tables above) with Supabase; confirm **single private proof bucket** + PIN gate via `gallery-access` + RLS-backed signed URLs.
- [x] Wireframes: session detail gallery block (create/list), client gallery view, selection counters, watermark toggle modal.
- [x] Decide watermark source priority: uploaded logo vs. business name text.

### Phase 1 — Proofing MVP (build & ship)
 - UX & flows
  - [x] Session detail/sheet: “Create gallery” sheet (title, type, status, event date defaulted from session) and list of galleries (type, status, updated).
  - [x] Gallery detail uploads: drag/drop + picker, async queue, client-side WebP conversion (JPEG fallback), per-file cancel/retry, previews; per-set upload routing.
    - [x] Proof-only storage (no originals): convert ~2560px long edge; store under `<org_id>/galleries/<gallery_id>/proof/<asset_id>.<ext>` and persist metadata in `gallery_assets.metadata`.
    - [x] Queue states: queued → processing → uploading → done/failed/canceled; per-file cancel/retry; preview thumbnails from resized blobs.
    - [x] Progress UX: per-set progress bar (sidebar) + active-set banner in right panel (`uploaded/total` + ETA); completion chip shown only until set content changes.
    - [ ] Server/edge transcode fallback (if needed for legacy browsers / hardening).
  - [x] Destructive deletes: set delete confirms and deletes assets (DB + storage) without fallback; gallery delete button (typed-name) fully removes sets/assets/client selections + storage objects.
  - [x] Client preview (“Önizle”): `/galleries/:id/preview` renders the exact client UI for internal users (favorite/select, counters, submit simulation).
  - [x] Watermark settings: toggle on/off, choose source (logo/text), opacity/placement presets (client-side overlay; not baked into files).
  - [x] Share (real client): stable public link + PIN; share sheet with copy-to-clipboard + WhatsApp/email quick actions.
    - PIN lives under Gallery “Ayarlar” tab → “Gizlilik” section; share uses `/g/:publicId` (public) + PIN gate.
    - Optional follow-ups: `expires_at` enforcement + require `status=published` for public access.
  - [x] Client view (real client): `/g/:publicId` PIN gate → client-mode UI (responsive grid, lazy paging, lightbox, favorites/selections, counters).
- Data & services
  - [x] Supabase Storage: **single private bucket** for proofs (Phase 1), object paths prefixed by `organization_id/` for RLS.
  - [x] Edge functions:
    - `gallery-access`: validate `public_id + PIN`, then issue/refresh a `gallery_access_grants` row (used by RLS + Storage select policy).
    - `gallery-branding`: return safe branding payload (logo/name/title) for the public PIN gate (no-store).
  - [x] Netlify Edge Functions for social previews: `gallery-og` injects OG tags for `/g/*`, `gallery-og-image` redirects `/og/g/*` to a signed cover image.
  - [x] Tables (`galleries`, `gallery_assets`, `client_selections`) landed; `gallery_sets` added for multiple sets within a gallery; `selection_template` nullable on services for deliverable rules.
  - [x] Queries to persist client selections/overrides + share/PIN fields. *(Client selections are stored in `client_selections`; public access is via `public_id` + `gallery_access`.)*
- Validation & QA
  - [x] Basic tests: `src/pages/__tests__/GalleryPublic.test.tsx`, `src/components/galleries/__tests__/GalleryShareSheet.test.tsx`, `src/components/galleries/__tests__/GalleryDetailSettings.test.tsx`, `src/components/galleries/__tests__/Lightbox.test.tsx`, plus Deno tests for Supabase functions (`supabase/functions/tests/gallery-access.test.ts`, `supabase/functions/tests/gallery-branding.test.ts`).
  - [ ] Extend coverage: upload queue states, selection limit enforcement, and regressions around signed URL refresh.
  - [ ] Performance check on client view (web-size assets, lazy load).
  - [ ] Accessibility: keyboard selection, focus after PIN, alt text per asset.
- Release
  - [ ] Feature flag `galleries.m1`; roll out to internal orgs first.
  - [ ] Help docs snippet (how to create gallery, set PIN, request selections).

### Phase 2 — Delivery & Hardening
- [ ] Multiple rounds per session (e.g., Seçim → Final or custom types) with version indicators and optional copy-forward of selections between rounds.
- [ ] Download rules per gallery (disable downloads for proofs; allow originals for finals), optional zip export for photographer.
- [ ] Selection export (CSV/JSON + thumbnails) and “lock selections” to prevent edits post-approval.
- [ ] Client invites/audience list (emails) with activity tracking (viewed, favorited, downloaded) and reminder emails.
- [ ] Galleries index page with filters (status, session, project, client).
- [ ] Better ordering tools (drag to reorder, cover flag) and lightbox mode.

### Phase 3 — Delight & Commerce (later)
- [ ] Comments/annotations per image, per-part notes (e.g., “Retouch skin here”).
- [ ] Simple store/upsell hooks (print sizes, add-on items) tied to services/packages.
- [ ] Brand themes, custom domains, advanced analytics.

## Open Questions
- Do we need per-client invites in Phase 1 or is link + PIN sufficient?
- Preferred WebP sizing/quality presets for proof vs. final? (Default suggested: 2560px long edge @ ~75–80% quality.)
- Watermark source of truth: per-gallery upload or reuse organization logo/name automatically?
- Should selection templates live on services or packages (line items) given the new services revamp? Recommendation: store on services and copy onto package line items during package creation.

## Immediate Next Steps
1) Persist “seçim gönderildi/confirm” state (DB) + surface it in admin (and optionally notify photographer).
2) Enforce `status=published` + `expires_at` for `/g/:publicId` and OG edge responses (fallback meta/image when gated).
3) Add stronger privacy controls: optional “hide cover preview in OG” toggle for strict clients.
4) Hardening: server-side transcode fallback + (optional) server-side watermarking for downloadable proofs.
5) QA pass: accessibility + performance + expand tests around selection limits and upload queue.

## Phase 1 UI status (services/settings)
- ✅ Optional selection template UI shipped in Services (deliverable-only): indigo-styled card, toggle off by default, single-line rule rows (Part, Min, Max, Required checkbox, Delete).
- ✅ Backward-compatible: `selection_template` is nullable; existing orgs stay untouched until they enable and add rules.
- ✅ Dirty guard: turning off the template when there are unsaved changes prompts a guard dialog.
- ✅ Copy tightened (EN/TR); helper shows example counts; “Kural ekle” button styled to match the new card.
- ✅ Session detail/sheet now creates galleries via a sheet (no modal); fields: title, type (Selections/Retouch/Final/Other), status, event date (defaults from session, changeable). Creation seeds a default set (Highlights/Öne çıkanlar), then redirects to `/galleries/:id`.
- ✅ Galleries list per session (fetches from Supabase); empty state CTA remains, header CTA hidden when empty to avoid duplicates.
- ✅ Gallery detail page `/galleries/:id`: back arrow to session, editable title/type/status/event date, save action; sets sidebar with list and “Add set” sheet; upload flow wired to Supabase Storage. All backed by new Supabase tables.
- ✅ Gallery detail proofing/admin polish: per-set upload routing + counts, right-panel upload progress banner + completion chip, set delete (with DB+storage cleanup, no fallback), gallery delete (typed-name, full cascade), filter-mode hides set actions, improved empty states, soft-emerald dropzone highlight, batch selection in grid/list, safer “seçimi kaldır” confirm UI, and image-only uploads (mixed drops skip non-images with a warning).
- ✅ Admin console: Admin → Users → Gallery tab includes lead name + preview/archive/delete actions for each gallery.

### In-app gallery UX (current)
- Gallery create sheet (max-w-3xl) mirrors the selection schema UI used in services: service groups show service name input, “Kural ekle” for service-scoped rules, and “Seçime aç/kapat” to disable a service; a manual “İlave kurallar” block sits underneath with a pill + add button. Saving seeds `branding.selectionTemplateGroups` and a flattened `selectionTemplate`.
- Gallery detail admin focuses on upload + per‑photo selection: grid/list views with batch select, safe two‑step deselect, and a lightbox with filename header, photographer star in right rail, and read‑only client favorite indicator.
- Multi-set workflow: uploads are scoped to the active set like folders; sets show per-set photo counts + upload progress; empty states are contextual; set deletion is guarded and deletes all contained media (DB + storage) without fallback.
- Gallery header: “Önizle” (client preview), “Paylaş” (share sheet), + “Galeriyi sil” (typed-name confirm).
- Selection dashboard/filters: visible on proof galleries; filter-mode hides set actions. Client selections (favorites + per-rule selections) are persisted in `client_selections`.
- Branding payload now carries both `selectionTemplateGroups` (grouped) and `selectionTemplate` (flattened). Required is persisted per rule.

### Manual/general rules UI (hizmetten bağımsız)
- Render a distinct “İlave kurallar” group below service-driven selection rows; group header shows a small `Hizmetten bağımsız` pill.
- Place a single secondary button on that header: “+ Genel kural ekle”; only this group has an add button to avoid mixing with service templates.
- New rows added here default `scope`/`part` to `Genel` and visually differ via a neutral left rail or background so users do not confuse them with service rules.
- Keep the add button visible only when the “İlave kurallar” group is present; service groups remain read-only aside from per-row edit/delete.
- Optional: make group headers sticky in long lists so it stays clear which group is being edited while scrolling.

### Gallery create sheet — selection rules block
- If the session includes services with selection templates, surface a compact rules preview inside the create sheet (after the basic fields) so the photographer sees limits before publishing.
- Service-driven rows stay read-only; directly below them render the same “İlave kurallar” group with the `Hizmetten bağımsız` pill and a single “+ Genel kural ekle” secondary button.
- Rows added here default to `Genel` scope and save with the new gallery so the detail page shows both service and manual rules.
- Keep the block collapsible to avoid sheet bloat; when expanded, show min/max/required badges and inline validation on new manual rows.

## Client View (shipped + remaining)
- ✅ **Access & branding**: `/g/:publicId` + PIN gate (anonymous session); optional studio logo/name via `gallery-branding`; tab title set from gallery + business name.
- ✅ **Layout & performance**: responsive grid with lazy paging per set; signed URLs via `createSignedUrl` and auto-refresh on broken images; lightbox with keyboard/swipe + improved mobile zoom/slide.
- ✅ **Selection UX**: favorites + per-rule selections persisted to `client_selections`; counters + “selected/unselected” filters; mobile tasks sheet; “Gönder/Onayla” locks actions in UI (not yet persisted).
- ✅ **Watermark**: configurable overlay (text/logo, opacity, placement) rendered client-side (not baked into files).
- ⚠️ **Privacy note**: OG previews use `/og/g/:publicId` to show a cover image via a service-role signed URL redirect; consider a “no cover preview” option for stricter privacy.
- 🔜 **Next**: persist selection submission state + admin visibility/notifications; enforce `published`/`expires_at`; delivery downloads/zip + activity tracking.
