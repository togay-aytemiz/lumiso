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
- `organization_settings.preferred_project_types` stores **only** the ordered intake selections. Unselected template slugs are still inserted into `project_types` (so they remain selectable in the app), but they are not appended back into the org setting or used by sample data unless the user picks them later.

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
| contract | Contract Signed | Sözleşme İmzalandı | `#3B82F6` | active. |
| in_progress | In Progress | Devam Ediyor | `#A855F7` | active. |
| completed | Completed | Tamamlandı | `#16A34A` | completed. |
| cancelled | Cancelled | İptal | `#DC2626` | cancelled. |

### Session statuses (`default_session_status_templates`)

| Slug | EN Label | TR Label | Color | Lifecycle |
| --- | --- | --- | --- | --- |
| planned | Planned | Planlandı | `#6B7280` / `#4B5563` | active (initial + `is_system_initial`). |
| preparing | Preparing | Hazırlık | `#FACC15` | active. |
| in_progress | In Progress | Çekim Sürüyor | `#8B5CF6` | active. |
| completed | Completed | Tamamlandı | `#22C55E` | completed. |
| cancelled | Cancelled | İptal | `#DC2626` | cancelled. |

### Services (`default_service_templates`)
- Function: `ensure_default_services_for_org(owner_uuid, org_id)` (`20260222114500_locale_seed_templates.sql`).
- Injects both coverage and deliverable catalog rows, tagged `is_sample = true`. Prices shown are selling prices (costs also stored).
- Categories reuse the default service form buckets (Lead Photographer, Assistant Photographer, Albums, Drone Operator) so seeding never creates new custom categories.

| Slug | EN Name | TR Name | Category | Type | Price | Default Unit |
| --- | --- | --- | --- | --- | --- | --- |
| lead_photographer | Lead Photographer | Baş Fotoğrafçı | Lead Photographer | coverage | 6000 | day / gün |
| assistant_photographer | Assistant Photographer | Asistan Fotoğrafçı | Assistant Photographer | coverage | 3500 | day / gün |
| signature_album | Signature Album | Prestij Albüm | Albums | deliverable | 3000 | — |
| drone_addon | Drone Coverage | Drone Çekimi | Drone Operator | coverage (addon) | 1800 | hour / saat |

### Session types (`default_session_type_templates`)

| Slug | EN Name | TR Name | Duration | Category |
| --- | --- | --- | --- | --- |
| signature_session | Signature Session | Standart Çekim | 90 min | Photography / Fotoğrafçılık |
| mini_session | Mini Session | Mini Çekim | 30 min | Photography / Fotoğrafçılık |

- `organization_settings.default_session_type_id` is backfilled to the first seeded type when empty so booking flows have a default.

### Packages (`default_package_templates`)
- Function: `ensure_default_packages_for_org(owner_uuid, org_id)` (same migration).
- Locale detection now normalizes the browser language (e.g. `tr-TR` → `tr`) so Turkish copy is seeded whenever the org prefers Turkish.
- Before inserting, it ensures services exist and maps template line items to the org’s service IDs. If a template service is missing it is created on the fly so packages always reference the catalog. `default_add_ons` collects any line items with role `addon`.
- Delivery settings stay disabled (empty `delivery_methods`, no photo-count estimates) to mirror the “no switch toggled” requirement coming from the UI.
- `pricing_metadata` encodes deposit guidance pulled through onboarding: `wedding_story` carries a 40 % base deposit suggestion, `mini_lifestyle` carries 30 %, and the computed deposit amount is stored so package cards surface the same numbers shown inside the builder.

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
- Blocks now follow the template-builder schema and use single-brace placeholders (`{lead_name}`, `{session_date}`, etc.). Each confirmation/reminder ships with a Session Details block that only shows the name, type, date, time, notes, and location toggles so the default template isn’t cluttered with other switches.

| Slug | EN Name / Subject | TR Name / Subject | Placeholders | Body Highlights |
| --- | --- | --- | --- | --- |
| session_confirmation | “Session Scheduled Confirmation” / “Your session is booked for {session_date}” | “Seans Planlandı Onayı” / “{session_date} tarihli çekiminiz onaylandı” | `{lead_name, session_name, session_date, session_time, session_type, session_notes, session_location}` | Intro text + localized Session Details block with the required switches enabled. |
| session_reminder | “Session Reminder (3 days)” / “Reminder: session on {session_date}” | “Seans Hatırlatıcısı (3 gün)” / “{session_date} tarihli çekiminiz yaklaşıyor” | `{session_name, session_date, session_time, session_type, session_notes, session_location}` | Light reminder copy followed by the same Session Details block. |

### Workflow seeds

**Template-driven workflows (`ensure_default_workflows_for_org`, `20260222141000_delivery_workflow_templates.sql`):**
- Determined by locale (falls back to EN) and rely on the seeded message templates.

| Slug | Name | Trigger | Conditions | Steps |
| --- | --- | --- | --- | --- |
| session_confirmation | Session Scheduled Confirmation / Seans Planlandı Onayı | `session_scheduled` | — | Single `send_notification` step referencing `session_confirmation` template via email. |
| session_reminder_workflow | Session Reminder (3 days) / Seans Hatırlatıcısı (3 gün) | `session_reminder` | `reminder_hours = 72` | Single `send_notification` step referencing `session_reminder` template via email. |

**Dedicated reminder workflow (`ensure_default_session_reminder_workflows`, `20260322120000_onboarding_polish.sql`):**
- Seeds a single `session_reminder` workflow (email only) that fires 72 hours before the session, so the Workflow list only shows the confirmation + 3-day reminder pair.

### Other defaults touched indirectly
- `ensure_default_message_templates` and `ensure_default_session_reminder_workflows` are called before workflows to guarantee dependent assets exist.
- `ensure_default_session_types_for_org` updates `organization_settings.default_session_type_id` if unset.
- Working hours & notification settings are not re-run here (handled during org creation), so only the entities above are reseeded post-intake.

## Sample-Data Seeds (only when `seed_sample_data_onboarding = true`)
- Function: `seed_sample_data_for_org(owner_uuid, org_id, locale, preferred_slugs)` within the same hotfix migration.
- Skips if any lead already contains `[Sample Data]` in `notes`.
- Additional guardrails:
  - `preferred_slugs` is sanitized to unique, template-backed slugs before seeding. Only those selections drive `organization_settings.preferred_project_types` and sample-data creation; unselected template slugs remain available in `project_types` but never get demo data.
  - Project stages, lead statuses, services, session types, packages, message templates, and workflows are reseeded by the always-on helpers **before** `seed_sample_data_for_org` runs so that every reference (`project_status_id`, `session_type_id`, `package_id`, etc.) points to known preseeded entities.
  - Package picks are limited to `wedding_story` and `mini_lifestyle`; the insert clones their pricing metadata (deposit percentage, VAT preferences, etc.) and mirrors it onto each project’s `deposit_config`.
- Locale-specific fixtures:
  - **Localization & communication policy**
    - Turkish (`tr`) copy is the canonical source for names, notes, and contact details. Every lead stores TR emails/phones (e.g., `sample+wedding.tr@lumiso.app`, `+90 532 ...`), and other locales reuse those values unless an explicit translation exists.
    - Notes / descriptions are stored as `[Sample Data] <TR message>` and optionally `notes_en`. Whenever a translation is missing we fall back to the TR string so nothing ships in English-only.
  - **Leads** (6 total, all localized):

    | # | TR Name | EN Name | Status slug | Email | Phone | Notes (TR → EN) |
    | --- | --- | --- | --- | --- | --- | --- |
    | 1 | Ayşe & Mehmet | Sarah & Daniel | `new` | `sample+wedding.tr@lumiso.app` | `+90 532 000 0010` | `[Sample Data] Fuar standında tanışıldı, hızlı teklif istedi.` → “Met at the expo, expecting a fast quote.” |
    | 2 | Zeynep Kılıç | Olivia Carter | `proposal` | `sample+family.tr@lumiso.app` | `+90 532 000 0011` | `[Sample Data] Sözleşme taslağı gönderildi, onay bekliyor.` → “Draft contract sent, waiting on approval.” |
    | 3 | Ece & Bora | Noah & Emma | `won` | `sample+referral.tr@lumiso.app` | `+90 532 000 0012` | `[Sample Data] Referans müşteri, albüm yükseltmesi istedi.` → “Referral client requesting album upgrade.” |
    | 4 | Deniz & Kerem | Lucas & Mia | `negotiation` | `sample+event.tr@lumiso.app` | `+90 532 000 0013` | `[Sample Data] Çift bütçe güncellemesi istedi, yeni teklif hazırlandı.` → “Couple asked for budget revision; new quote drafted.” |
    | 5 | Selin Aksoy | Emily Parker | `qualified` | `sample+portrait.tr@lumiso.app` | `+90 532 000 0014` | `[Sample Data] Portre konsepti netleşti, çekim tarihi bekleniyor.` → “Portrait concept approved, waiting for shoot date.” |
    | 6 | Burcu & Tolga | Grace & Ethan | `lost` | `sample+mini.tr@lumiso.app` | `+90 532 000 0015` | `[Sample Data] Rakip çekim paketini seçti, değerlendirme notu bırakıldı.` → “Chose a competitor package; captured follow-up note.” |

  - **Projects (selected-type aware)**:
    - Maintain `sample_project_blueprints` keyed by project-type slug (e.g., `wedding`, `family`, `commercial`, etc.). Each blueprint defines localized titles, default package slug, stage, primary lead, and which services must be attached.
    - When seeding, iterate over `preferred_slugs` (ordered) and create one project per slug (cap at four to keep datasets manageable). If the intake list is empty, fall back to `wedding` and `family`.
    - Example blueprints:

      | Project type slug | Project title (TR / EN) | Default package | Default stage |
      | --- | --- | --- | --- |
      | wedding | “Boğaz Düğünü” / “Bosphorus Wedding” | `wedding_story` | `in_progress` |
      | family | “Aile Lifestyle Çekimi” / “Lifestyle Family Session” | `mini_lifestyle` | `in_progress` |
      | commercial | “Marka Lansman Çekimi” / “Brand Launch Shoot” | `wedding_story` (fallback) | `proposal` |
      | newborn | “Yenidoğan Belgeseli” / “Newborn Documentary” | `mini_lifestyle` | `planned` |

    - Every project attaches exactly one seeded package; package line items always resolve back to the preseeded services (`lead_photographer`, `assistant_photographer`, etc.), ensuring catalog consistency.
    - `projects.description` stores a localized `[Sample Data]` note describing status, and each project records a `deposit_config` snapshot (40 % for wedding_story, 30 % for mini_lifestyle) so payment workflows have data to display.
    - For every project we insert two `activities`: one `note` describing current context and one `reminder` scheduled `+N` days from intake completion (default anchor is `profile_intake_completed_at`, falling back to org creation) so teams immediately see future follow-ups.
  - **Sessions**
    - Each seeded project creates one session scheduled relative to the anchor timestamp at +1, +3, +7 days (then +14, +21, +30 if we have more projects). All sessions stay in the future, regardless of locale or time of day.
    - Session labels mirror the project type (“Düğün Çekimi”, “Kurumsal Çekim”, …) with locale-specific copy and reuse the seeded session types (`signature_session` for long form, `mini_session` for short form).
    - Locations intentionally stay high level for Turkish orgs (e.g., “Kadıköy Stüdyosu”, “Moda Sahili”, “Galata Meydanı”) so the sample data feels local without exposing exact addresses.
  - **Packages / services / workflows**
    - Packages referenced above are seeded via `ensure_default_packages_for_org` and therefore only use the default service categories (Lead Photographer, Assistant Photographer, Albums, Drone Operator). No ad-hoc services are created during sample-data seeding.
    - Sessions/projects automatically link to the workflow + message templates that were inserted earlier so reminders fire without extra setup.
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
