# Intake Seeding Inventory

This note captures **everything that `process_intake_seed` currently writes** after a user completes the intake form. Use it to verify migrations, telemetry, and QA scenarios across locales.

## Trigger & Flow Overview
- `organization_settings.profile_intake_completed_at` update fires `trigger_enqueue_intake_seeding` (`20260222151500_seeding_function_hotfix.sql`).
- Trigger enqueues/upserts `intake_seeding_queue` with `seed_sample_data = organization_settings.seed_sample_data_onboarding`.
- `public.process_intake_seed(target_org_id)` runs immediately and logs lifecycle events through `log_intake_seeding_event`. It resolves:
  - `owner_uuid` (organization owner),
  - `preferred_project_types` (ordered slugs from intake),
  - `preferred_locale` via `get_org_locale` (defaults to `tr`).
- The helper seeds **baseline configuration for everyone**, then conditionally calls `seed_sample_data_for_org` when the toggle is true. Queue rows are marked processed to keep things idempotent.

## Always-On Seeds (independent of sample-data toggle)

### Project types (locale-aware)
- Function: `ensure_default_project_types_for_org(owner_uuid, org_id, preferred_slugs, locale, force_replace := true)` (`20260222133000_project_type_templates.sql`).
- Behavior: wipes previous project types, injects the ordered intake selections first, then fills remaining template slugs using `preferred_locale` fallback to EN. First inserted type is flagged `is_default`.

| Slug | EN Label | TR Label | Notes |
| --- | --- | --- | --- |
| wedding | Wedding | Düğün | Full wedding coverage. |
| family | Family | Aile | Family portraits. |
| children | Children | Çocuk | Kids milestones. |
| maternity | Maternity | Hamilelik | Maternity sessions. |
| birth | Birth | Doğum | Birth-story coverage. |
| newborn | Newborn | Yenidoğan | Lifestyle newborn. |
| headshots | Headshots | Portre | Professional portraits. |
| senior | Senior | Mezuniyet | Graduation sessions. |
| commercial | Commercial | Ticari | Brand/product shoots. |
| event | Event | Etkinlik | Corporate & social events. |
| pet | Pet | Evcil Hayvan | Pets + humans. |
| real_estate | Real Estate | Gayrimenkul | Property listings. |

### Lead statuses (`default_lead_status_templates`)
- Function: `ensure_default_lead_statuses_for_org(owner_uuid, org_id)` (`20260222124500_status_templates.sql`).
- Lifecycle metadata drives pipeline logic (`lifecycle` and `is_system_final`).

| Slug | EN Label | TR Label | Color | Lifecycle |
| --- | --- | --- | --- | --- |
| new | New | Yeni | `#6B7280` / `#4B5563` | active (initial). |
| qualified | Qualified | Nitelikli | `#FACC15` | active. |
| proposal | Proposal Sent | Teklif Gönderildi | `#3B82F6` | active. |
| negotiation | Negotiation | Görüşme | `#A855F7` | active. |
| won | Won | Kazanıldı | `#22C55E` | completed (positive terminal). |
| lost | Lost | Kaybedildi | `#DC2626` | cancelled (negative terminal). |

### Project statuses (`default_project_status_templates`)
- Function: `ensure_default_project_statuses_for_org(owner_uuid, org_id)`.
- Inserts localized stages with lifecycle + color semantics and respects EN fallback.

| Slug | EN Label | TR Label | Color | Lifecycle |
| --- | --- | --- | --- | --- |
| planned | Planned | Planlandı | `#6B7280` / `#4B5563` | active (initial, system required). |
| proposal | Proposal Sent | Teklif Gönderildi | `#FBBF24` | active. |
| contract | Contract Signed | Sözleşme İmzalandı | `#22C55E` | active. |
| in_progress | In Progress | Devam Ediyor | `#A855F7` | active. |
| completed | Completed | Tamamlandı | `#16A34A` | completed. |
| cancelled | Cancelled | İptal | `#DC2626` | cancelled. |

### Session statuses (`default_session_status_templates`)

| Slug | EN Label | TR Label | Color | Lifecycle |
| --- | --- | --- | --- | --- |
| planned | Planned | Planlandı | `#6B7280` / `#4B5563` | active (initial + `is_system_initial`). |
| scheduled | Scheduled | Planlandı | `#0EA5E9` | active. |
| preparing | Preparing | Hazırlık | `#FACC15` | active. |
| in_progress | In Progress | Çekim Sürüyor | `#8B5CF6` | active. |
| completed | Completed | Tamamlandı | `#22C55E` | completed. |
| cancelled | Cancelled | İptal | `#DC2626` | cancelled. |

### Services (`default_service_templates`)
- Function: `ensure_default_services_for_org(owner_uuid, org_id)` (`20260222114500_locale_seed_templates.sql`).
- Injects both coverage and deliverable catalog rows, tagged `is_sample = true`. Prices shown are selling prices (costs also stored).

| Slug | EN Name | TR Name | Category | Type | Price | Default Unit |
| --- | --- | --- | --- | --- | --- | --- |
| lead_photographer | Lead Photographer | Baş Fotoğrafçı | Crew / Ekip | coverage | 6000 | day / gün |
| assistant_photographer | Assistant Photographer | Asistan Fotoğrafçı | Crew / Ekip | coverage | 3500 | day / gün |
| signature_album | Signature Album | Prestij Albüm | Deliverables / Teslimatlar | deliverable | 3000 | — |
| drone_addon | Drone Coverage | Drone Çekimi | Deliverables / Teslimatlar | coverage (addon) | 1800 | hour / saat |

### Session types (`default_session_type_templates`)

| Slug | EN Name | TR Name | Duration | Category |
| --- | --- | --- | --- | --- |
| signature_session | Signature Session | Standart Çekim | 90 min | Photography / Fotoğrafçılık |
| mini_session | Mini Session | Mini Çekim | 30 min | Photography / Fotoğrafçılık |

- `organization_settings.default_session_type_id` is backfilled to the first seeded type when empty.

### Packages (`default_package_templates`)
- Function: `ensure_default_packages_for_org(owner_uuid, org_id)` (same migration).
- Before inserting, it ensures services exist and maps template line items to the org’s service IDs. `default_add_ons` collects any line items with role `addon`.

| Slug | EN Name | TR Name | Price | Intended Types | Contents |
| --- | --- | --- | --- | --- | --- |
| wedding_story | Wedding Story | Düğün Hikayesi | 15 000 | `['Wedding' / 'Düğün']` | Lead + Assistant Photographers (base), Prestij/Signature album (addon), Drone coverage (addon). |
| mini_lifestyle | Mini Lifestyle | Mini Lifestyle | 4 500 | `['Family','Portrait']` / `['Aile','Portre']` | Lead Photographer (base), Signature/Prestij album (addon). |

### Delivery methods (`default_delivery_method_templates`)

| Slug | EN Name | TR Name | Description |
| --- | --- | --- | --- |
| digital_gallery | Digital Gallery | Dijital Galeri | High-res gallery through Lumiso client portal. |
| usb_drive | Branded USB Drive | USB Bellek | Branded drive containing retouched files. |

### Message templates (`default_message_template_templates`)
- Function: `ensure_default_message_templates(owner_uuid, org_id)` (`20260222121500_message_workflow_templates.sql` + placeholder fix `20260222155000`).
- Blocks now follow the template-builder schema and use single-brace placeholders (`{lead_name}`, `{session_date}`, etc.).

| Slug | EN Name / Subject | TR Name / Subject | Placeholders | Body Highlights |
| --- | --- | --- | --- | --- |
| session_confirmation | “Session Confirmation” / “Your session is booked for {session_date}” | “Çekim Onayı” / “{session_date} tarihli çekiminiz onaylandı” | `{lead_name, session_date, session_time, session_location}` | Friendly confirmation text with location + reply CTA. |
| session_reminder | “Session Reminder (3 days)” / “Reminder: session on {session_date}” | “Çekim Hatırlatıcısı (3 gün)” / “{session_date} tarihli çekiminiz yaklaşıyor” | `{lead_name, session_date, session_time}` | Reminder to confirm timing; TR copy mirrors EN tone. |

### Workflow seeds

**Template-driven workflows (`ensure_default_workflows_for_org`, `20260222141000_delivery_workflow_templates.sql`):**
- Determined by locale (falls back to EN) and rely on the seeded message templates.

| Slug | Name | Trigger | Conditions | Steps |
| --- | --- | --- | --- | --- |
| session_confirmation | Auto-confirm session / Çekim Onayı Otomasyonu | `project_status_changed` | `target_status_slug = 'planned'` | Single `send_notification` step referencing `session_confirmation` template via email. |
| session_reminder_workflow | Reminder 3 days before / 3 Gün Önce Hatırlatma | `session_scheduled` | `offset_hours = 72` | Single `send_notification` step referencing `session_reminder` template via email. |

**Legacy reminder workflows (`ensure_default_session_reminder_workflows`, `20250909194528_a6d29024….sql`):**
- Still runs (called before template workflows). Only seeds when no existing `trigger_type = 'session_reminder'` rows.
  - *24-Hour Session Reminder*: trigger `session_reminder` with `{"reminder_hours":24}`, sends email via the `session_reminder` template.
  - *2-Hour Session Reminder*: same trigger with `{"reminder_hours":2}`, sends SMS + WhatsApp through the same template.

### Other defaults touched indirectly
- `ensure_default_message_templates` and `ensure_default_session_reminder_workflows` are called before workflows to guarantee dependent assets exist.
- `ensure_default_session_types_for_org` updates `organization_settings.default_session_type_id` if unset.
- Working hours & notification settings are not re-run here (handled during org creation), so only the entities above are reseeded post-intake.

## Sample-Data Seeds (only when `seed_sample_data_onboarding = true`)
- Function: `seed_sample_data_for_org(owner_uuid, org_id, locale, preferred_slugs)` within the same hotfix migration.
- Skips if any lead already contains `[Sample Data]` in `notes`.
- Locale-specific fixtures:
  - **Leads** (3):
    1. “Ayşe & Mehmet” / “Sarah & Daniel” – status `new`, email `sample+wedding@lumiso.app`, notes “Booked via expo show.”
    2. “Zeynep Kılıç” / “Olivia Carter” – status `proposal`, notes “Waiting for contract.”
    3. “Ece & Bora” / “Noah & Emma” – status `won`, notes “Returning client from referral.”
  - **Projects** (2):
    - Project 1 uses lead 1, `project_status = in_progress`, `project_type = preferred_slugs[1] (fallback wedding)`, package `wedding_story`, price pulled from package.
    - Project 2 uses lead 2, `project_status = completed`, `project_type = preferred_slugs[2] fallback family`, package `mini_lifestyle`.
  - **Sessions** (3):
    - Session labels: locale-specific (“Düğün Çekimi”, “Aile Lifestyle”, “Mini Çekim” or EN equivalents).
    - Dates scheduled at +3, +10, +18 days from `now()` (UTC) to avoid past events.
    - Session types: `signature_session` for first two, `mini_session` for the add-on.
    - Locations: “Old Town”, “City Park”, “Studio Loft” (shared across locales).
- All inserted rows carry `[Sample Data]` prefix in `notes` so reruns short-circuit.

## Telemetry & Monitoring Touchpoints
- Every helper call inside `process_intake_seed` logs start/success/failure via `log_intake_seeding_event` with metadata (duration, locale, toggle state).
- Sample-data writer logs its own event block.
- Queue rows remain until `processed_at` is set, making it easy to monitor stuck orgs (`select * from intake_seeding_queue where processed_at is null`).

## What Is Preference-Driven vs. Static?
- **Locale-dependent**: project types, statuses, services, session types, packages, delivery methods, message templates, workflows, sample-data copy.
- **Intake preference-dependent**:
  - `preferred_project_types` array determines the ordering + guaranteed inclusion of project types and is referenced again when picking project/session types for sample data.
  - `seed_sample_data_onboarding` toggles whether leads/projects/sessions are created.
- **Static across orgs**: pricing, line items, colors, workflow triggers, delivery method set, reminder offsets (until we add more templates).

Use this inventory as the canonical reference when testing onboarding, verifying localized copy, or extending the catalog (add entries to the template tables + document them here).
