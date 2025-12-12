# Client Galleries & Proof Delivery — Phase Plan

## Purpose
- Ship a Phase 1 proofing + delivery flow that lets photographers upload, watermark, and share galleries per session, while capturing client selections for deliverables that require specific photo counts (albums, covers, prints).
- Keep scope lean but production-ready: async uploads, web-friendly proofs, PIN-protected client view, and a selection table photographers can configure or override.

## Current Snapshot (Lumiso)
- Session detail shows a placeholder gallery component (`SessionGallery.tsx`), no storage/upload or client-facing gallery yet.
- Services/packages already include an “Online gallery” delivery method; sessions live under projects and can have multiple sessions (engagement, wedding, newborn, etc.).
- No schema defined for galleries, proof assets, or per-deliverable selection requirements; project/session detail is the natural home for upload in Phase 1, with a future standalone Galleries index requested.

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
- Uploads run async with background conversion to WebP (with JPEG fallback) sized for proofing quality; originals stored separately for finals.
- Optional watermark (logo or business name) per gallery; toggleable before publish.
- Client view secured by share link + PIN; lightweight branding (logo/name) and “client mode” layout.
- Client can select/favorite photos up to configured limits per deliverable requirement (album pages, cover, back cover, prints). Counts enforced and visible.
- Photographer sees selections inside the service/session context and can override/adjust before final delivery.

## Data Model v1 (proposed)
- `galleries`: `id`, `session_id`, `project_id`, `type` (`proof|retouch|final|other`), `title`, `status` (`draft|published|archived`), `pin_hash`, `expires_at?`, `watermark_settings` (logo text/url, opacity, position), `branding` (name/logo), timestamps, `published_at`.
- `gallery_assets`: `id`, `gallery_id`, `storage_path_original`, `storage_path_web`, `width`, `height`, `content_hash`, `order_index`, `status` (`processing|ready|failed`), `metadata` (color profile, tags), timestamps.
- `gallery_clients` (optional Phase 2): `gallery_id`, `client_id|email`, `pin_hash_override?`, `access_role` (`view|download|owner`), `viewed_at`, `downloaded_at`.
- `deliverable_selection_templates`: linked to `service_id` (or package line item), stores rows like `{part, min, max, required, notes, aspect_ratio?, output_type}` to express “Album: 30 spreads, 1 cover, 1 back cover”.
- `client_selections`: `id`, `gallery_id`, `asset_id`, `selection_part` (e.g., `spread`, `cover`), `client_id|email`, `note?`, timestamps. Supports multiple selection rounds.

### Example selection template (album)
| Service | Part | Min | Max | Required | Notes |
| --- | --- | --- | --- | --- | --- |
| Album 30x30 | Spread | 20 | 30 | Yes | Main pages |
| Album 30x30 | Cover | 1 | 1 | Yes | Front cover |
| Album 30x30 | Back cover | 1 | 1 | Yes | Rear cover |

Templates attach to services/packages; when a session includes that deliverable, the gallery auto-loads its selection rules. Photographer can edit per gallery.

## Configuring Services for Selection Counts (how the system knows “what/How many”)
- Where to store rules: attach a selection template to each deliverable-type service (or package line item) that requires client picks. Use `deliverable_selection_templates` as the source of truth; copy it onto the session when that service is included.
- Shape to capture: `part` (Spread/Cover/Back cover/Print), `min`, `max`, `required` (bool), `notes`, optional `aspect_ratio` and `output_type` (e.g., `spread`, `single`, `cover`).
- Defaults and overrides:
  - **Service level**: define the template once per service (e.g., Album 30x30 → 30 spreads, 1 cover, 1 back cover).
  - **Package line-item level**: when a package contains that service, copy the template into the package payload so overrides (e.g., “Album 40x40” → 40 spreads) travel with the package.
  - **Session/gallery level**: when the project/session is created with those services, clone the template into the gallery config; the photographer can tweak counts before publishing.
- Runtime enforcement:
  - Client gallery reads the session-level template to render counters (remaining/selected) and blocks extra selections beyond `max`; required parts must be filled before submission/approval.
  - Photographer can override client picks (swap images or adjust counts) inside the session’s gallery admin view.
- Backward compatibility/migration:
  - Add a nullable `selection_template` jsonb to `services` (cached copy of the template rows) OR rely solely on `deliverable_selection_templates` table keyed by `service_id`.
  - Migration step: seed templates for existing deliverable services (albums, print packs, wall art) using sensible defaults; leave coverage-only services without templates.
- Example mappings:
  - “Album 30x30” → `{part: "Spread", min:20, max:30, required:true}`, `{part:"Cover", min:1, max:1, required:true}`, `{part:"Back cover", min:1, max:1, required:true}`
  - “10 Fine Art Prints” → `{part:"Print", min:10, max:10, required:true}`
  - “Canvas Trio” → `{part:"Canvas", min:3, max:3, required:true, aspect_ratio:"4:5"}`

## Phase Breakdown & Checklists

### Phase 0 — Design & Contract (1 week)
- [x] Finalize gallery types/states (proof, retouch, final) and copy (EN/TR).
- [x] Approve data model (tables above) with Supabase; confirm storage buckets (`galleries/proof`, `galleries/originals`) and edge function for WebP.
- [x] Wireframes: session detail gallery block (create/list), client gallery view, selection counters, watermark toggle modal.
- [x] Decide watermark source priority: uploaded logo vs. business name text.

### Phase 1 — Proofing MVP (build & ship)
- UX & flows
  - [x] Session detail/sheet: “Create gallery” sheet (title, type, status, event date defaulted from session) and list of galleries (type, status, updated).
  - [ ] Upload modal with drag/drop, async queue, per-file status; background conversion to WebP + JPEG fallback; web-size target (e.g., 2560px long edge, quality tuned). _(in progress: pipeline spec below)_
    - WebP-only storage to save space (no originals); convert at ~2560px long edge, quality ~80, strip metadata but keep color profile.
    - Frontend pre-resize before upload when possible; hashed filenames under `galleries/proof/`; persist JSON sidecar with width/height/size/checksum.
    - Queue states: queued → uploading → processing → done/failed; drag/drop + file picker; per-file cancel/retry; show preview thumbnail from resized blob.
    - Server/edge transcode fallback to ensure WebP; on legacy browsers serve on-the-fly JPEG if needed (no persistent originals).
  - [ ] Watermark settings: toggle on/off, choose source (logo/text), opacity/placement presets.
  - [ ] Share: generate public link + PIN; copy-to-clipboard; optional expiry date.
  - [ ] Client view: responsive grid, lazy load, favorite/select buttons with remaining counts, PIN gate, branding header.
- Data & services
  - [ ] Supabase storage buckets + rules for originals vs. proofs; edge function (or worker) to transcode to WebP/JPEG and write metadata.
  - [x] Tables (`galleries`, `gallery_assets`, `client_selections`) landed; `gallery_sets` added for multiple sets within a gallery; `selection_template` nullable on services for deliverable rules.
  - [ ] API endpoints/queries to fetch galleries by session/project and to persist selections/overrides. *(Session list + gallery detail read/write exist; uploads/selections pending.)*
- Validation & QA
  - [ ] Component/integration tests for upload queue states, watermark toggles, PIN gate, selection limits.
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
1) Confirm data model + storage approach with backend/Supabase.
2) Approve wireframes for session detail gallery block and client view (EN/TR copy).
3) Create migrations + feature flag, then start Phase 1 build (upload/processing, PIN gate, selection counters).

## Phase 1 UI status (services/settings)
- ✅ Optional selection template UI shipped in Services (deliverable-only): indigo-styled card, toggle off by default, single-line rule rows (Part, Min, Max, Required checkbox, Delete).
- ✅ Backward-compatible: `selection_template` is nullable; existing orgs stay untouched until they enable and add rules.
- ✅ Dirty guard: turning off the template when there are unsaved changes prompts a guard dialog.
- ✅ Copy tightened (EN/TR); helper shows example counts; “Kural ekle” button styled to match the new card.
- ✅ Session detail/sheet now creates galleries via a sheet (no modal); fields: title, type (Selections/Retouch/Final/Other), status, event date (defaults from session, changeable). Creation seeds a default set (Highlights/Öne çıkanlar), then redirects to `/galleries/:id`.
- ✅ Galleries list per session (fetches from Supabase); empty state CTA remains, header CTA hidden when empty to avoid duplicates.
- ✅ Gallery detail page `/galleries/:id`: back arrow to session, editable title/type/status/event date, save action; sets sidebar with list and “Add set” sheet; media area placeholder (upload wiring pending). All backed by new Supabase tables.
- ✅ Gallery detail proofing/admin polish: per‑set upload routing + counts, set delete guard when photos exist, filter‑mode hides set actions, improved empty states, soft‑emerald dropzone highlight, batch selection in grid/list, and safer “seçimi kaldır” confirm UI.

### In-app gallery UX (current)
- Gallery create sheet (max-w-3xl) mirrors the selection schema UI used in services: service groups show service name input, “Kural ekle” for service-scoped rules, and “Seçime aç/kapat” to disable a service; a manual “İlave kurallar” block sits underneath with a pill + add button. Saving seeds `branding.selectionTemplateGroups` and a flattened `selectionTemplate`.
- Gallery detail admin focuses on upload + per‑photo selection: grid/list views with batch select, safe two‑step deselect, and a lightbox with filename header, photographer star in right rail, and read‑only client favorite indicator.
- Multi‑set workflow: uploads are scoped to the active set like folders; sets show per‑set photo counts; empty states are contextual; set deletion is guarded if the set contains photos.
- Selection dashboard/filters were removed from the admin view for now; filtering will be re‑surfaced once client selections are wired.
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

## Client View (inspired by Picflow / Pixpa / ShootProof / Pixieset / SmugMug)
- **Access & branding**: Share link + PIN gate; show studio logo/name; minimal header; optional expiry tag.
- **Layout & performance**: Masonry/grid with responsive breakpoints; lazy load & prefetch; WebP proofs + JPEG fallback; smooth lightbox with keyboard/swipe.
- **Selection UX**: Favorite/select toggle per image; remaining/selected counters; clear CTA (“Gönder/Onayla”); error state if required slots unmet; cover/back-cover flags.
- **Watermark & download**: Proofs watermarked; downloads off for proof; finals (Phase 2) allow original/zip per gallery policy.
- **Sorting & focus**: Optional cover badge pin; drag-to-reorder (Phase 2); spotlight mode for hero images (cover).
- **Activity & reminders**: Track viewed/selected (Phase 2); send reminder email for incomplete selections (Phase 2).
- **Mobile polish**: Single column, sticky bottom action bar (remaining count + submit), big tap targets.
- **Delight**: Soft transitions, hover states, and lightweight color theme that matches studio branding.
