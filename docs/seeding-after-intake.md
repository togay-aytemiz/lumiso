# Seeding After Intake Plan

## Goals
- Seed every newly onboarded workspace immediately after the intake form completes.
- Always create base configuration that matches the user’s selected project types.
- Respect the sample data toggle: project-type scaffolding happens for everyone, full demo data only when the user opts in.
- Persist **only** the ordered, user-selected project-type slugs inside `organization_settings.preferred_project_types`; keep the rest of the template catalog available but unselected.
- Generate sample data strictly from the selected project types by maintaining blueprints for every supported slug so we can handle any combination a user chooses.
- Treat Turkish as the canonical locale for sample data (names, notes, email, phone). Other locales reuse that content unless an explicit translation exists, giving us a predictable fallback.

## Entities To Seed When Sample Data Is Enabled

### Services (`/settings/services`)
- Reuse the default service form categories (Lead Photographer, Assistant Photographer, Albums, Drone Operator) so seeding never adds custom buckets.
- Seed four services with localized names/descriptions.
- Price points should be realistic (e.g., Lead/Assistant: “Baş Fotoğrafçı” and “Asistan”; Deliverables: “Drone Çekimi”, “Fotoğraf Albümü” in TR, English equivalents in EN).
- Tag each service with the default project type for filtering.
- Reuse the exact entries seeded by `ensure_default_services_for_org` (canonical default categories). Sample-data creation should not insert new service categories or bespoke services.
- Keep the category values tied to the canonical labels (`Lead Photographer`, `Assistant Photographer`, `Albums`, `Drone Operator`) so downstream filters and package builders never see ad-hoc buckets.

### Packages (`/settings/services`, Packages section)
- Create two packages that bundle the seeded services.
  - Example: “Premium Düğün Paketi” (includes both crew services + album).
  - Example: “Mini Çekim Paketi” (assistant + digital deliverable).
- Associate each package with the first selected project type; optionally list alternates from the remaining selections.
- While composing package line items, reference services by slug so we always point to the preseeded service rows. No package should introduce a service that doesn’t already exist in the catalog.
- Delivery toggles stay off by default (no photo-count estimates, no lead-time values) to mirror the UI requirement.
- `pricing_metadata` must include deposit hints: 40 % of the base price for `wedding_story`, 30 % for `mini_lifestyle` (mode = `percent_base`, target = base). These values feed project creation and the Project Payments views.

### Session Types (`/settings/services`, Session Types section)
- Seed two types:
  1. “Standart Çekim” – duration 3 hours, description explaining typical coverage.
  2. “Mini Çekim” – duration 30 minutes, description clarifying it’s a short session.
- Do **not** include duration in the title; rely on the dedicated duration field.
- These types must be identical to the `signature_session` and `mini_session` rows inserted by `ensure_default_session_types_for_org`, and `organization_settings.default_session_type_id` should default to `signature_session`.

### Leads / Projects / Sessions
#### Lead roster (6 localized leads)
- Create six localized leads so we can demonstrate multiple pipeline states. All notes and contact information originate in Turkish; English (and other locales) reuse those strings unless a translation exists.
- Lead details:

  | # | TR Name | EN Name | Status slug | Email | Phone | Notes (TR → EN) |
  | --- | --- | --- | --- | --- | --- | --- |
  | 1 | Ayşe & Mehmet | Sarah & Daniel | `new` | `sample+wedding.tr@lumiso.app` | `+90 532 000 0010` | `[Sample Data] Fuar standında tanışıldı, hızlı teklif istedi.` → “Met at the expo, expecting a fast quote.” |
  | 2 | Zeynep Kılıç | Olivia Carter | `proposal` | `sample+family.tr@lumiso.app` | `+90 532 000 0011` | `[Sample Data] Sözleşme taslağı gönderildi, onay bekliyor.` → “Draft contract sent, waiting on approval.” |
  | 3 | Ece & Bora | Noah & Emma | `won` | `sample+referral.tr@lumiso.app` | `+90 532 000 0012` | `[Sample Data] Referans müşteri, albüm yükseltmesi istedi.` → “Referral client requesting album upgrade.” |
  | 4 | Deniz & Kerem | Lucas & Mia | `negotiation` | `sample+event.tr@lumiso.app` | `+90 532 000 0013` | `[Sample Data] Çift bütçe güncellemesi istedi, yeni teklif hazırlandı.` → “Couple asked for budget revision; new quote drafted.” |
  | 5 | Selin Aksoy | Emily Parker | `qualified` | `sample+portrait.tr@lumiso.app` | `+90 532 000 0014` | `[Sample Data] Portre konsepti netleşti, çekim tarihi bekleniyor.` → “Portrait concept approved, waiting for shoot date.” |
  | 6 | Burcu & Tolga | Grace & Ethan | `lost` | `sample+mini.tr@lumiso.app` | `+90 532 000 0015` | `[Sample Data] Rakip çekim paketini seçti, değerlendirme notu bırakıldı.` → “Chose a competitor package; captured follow-up note.” |

- Use the localized lead statuses seeded via `ensure_default_lead_statuses_for_org` so pipelines look real in every locale.

#### Projects (selected-type aware)
- Keep a `sample_project_blueprints` map keyed by every supported project type slug. Each entry defines localized project titles, default package slug, preferred stage, and target session type.
- When seeding, iterate over the ordered `preferred_project_types` list and create at most one project per slug (limit to four to avoid over-seeding). If the user did not pick any types, fall back to `['wedding','family']`.
- Example blueprint subset:

  | Project type slug | Project title (TR / EN) | Default package | Stage | Session type |
  | --- | --- | --- | --- | --- |
  | wedding | “Boğaz Düğünü” / “Bosphorus Wedding” | `wedding_story` | `in_progress` | `signature_session` |
  | family | “Aile Lifestyle Çekimi” / “Lifestyle Family Session” | `mini_lifestyle` | `in_progress` | `signature_session` |
  | commercial | “Marka Lansman Çekimi” / “Brand Launch Shoot” | `wedding_story` (until we add a commercial bundle) | `proposal` | `mini_session` |
  | newborn | “Yenidoğan Belgeseli” / “Newborn Documentary” | `mini_lifestyle` | `planned` | `signature_session` |

- Every project must attach a seeded package so package line items continue to reference the canonical services.
- Persist a localized `[Sample Data]` description on each project, store a `deposit_config` snapshot that mirrors the selected package metadata, and insert two `activities` per project (one note + one reminder). Reminders must be scheduled `+N` days from the intake completion timestamp so they always point to the future.

#### Sessions
- Each project gets exactly one scheduled session. Offsets: +1, +3, +7, +14, +21, +30 days from `profile_intake_completed_at` (fall back to org creation, then `now()`) so appointments never land in the past.
- Session labels are locale-aware (“Düğün Çekimi”, “Kurumsal Çekim”, etc.) and the `session_type_id` always points to the seeded `signature_session` or `mini_session`.
- Locations rotate through high-level Turkish landmarks (e.g., “Kadıköy Stüdyosu”, “Moda Sahili”, “Galata Meydanı”) so the data feels local without sharing exact addresses.

#### Data integrity
- Prefix every seeded note/title with `[Sample Data]` so reruns can detect duplicates.
- Project stages, session stages, lead statuses, services, packages, session types, workflows, and message templates must be seeded (or revalidated) **before** we attempt to create these leads/projects/sessions.

### Email Templates
- Add 2 templates (localized content):
  1. Session-created notification.
  2. Session reminder (3 days before).
- Include placeholders for session date/time and package details; mark both templates as active.
- Provide TR copy first, then optional EN translations. When no translation exists, render the TR version to satisfy the “fallback always Turkish” rule.

### Workflows
- Seed 2 active workflows per locale:
  1. New project workflow – triggers on project creation, sends localized session-created email + schedules tasks.
  2. Session reminder workflow – runs 3 days before each session, sends localized reminder email and optionally creates a follow-up task.
- Ensure workflows reference the seeded templates in the same locale.
- Confirm workflow definitions reference the TR-first templates so reminder content stays localized even when the org’s fallback locale is used.

## Entities To Seed For **Everyone**
- `organization_settings.preferred_project_types` (already captured via intake; always apply the ordered list).
- Service focus / defaults derived from the selected types.
- Locale-specific stage/status defaults (project, session, lead) and working-hours/notification settings.
- Session types (`signature_session`, `mini_session`) so sessions and workflows have valid references.
- Default services, packages, delivery methods, message templates, and workflows so sample-data seeding never has to create dependencies on the fly.
- Package pricing metadata (especially deposit percentages) has to stay in sync with `projects.deposit_config`, since sample projects copy those values verbatim.

## Outstanding Tasks
1. ✅ **Schema change:** add a boolean `seed_sample_data_onboarding` to `organization_settings` (migration `20260222100000`).
2. ✅ **Client update:** persist `wantsSampleData` into that column when intake finishes (`ProfileIntakeGate` updates).
3. ✅ **Preferred locale capture:** store `preferred_locale` on `organization_settings` (migration `20260222110000`) and send it from intake so templates can pick the right language.
4. ✅ **Localized templates:** add canonical service / session-type / package template tables + locale-aware helpers (`20260222114500`), localized message templates (`20260222121500`), and default lead/project/session stage templates (`20260222124500`).
5. ✅ **Seeding engine trigger:** enqueue/process orgs when intake finishes (`20260222130000_intake_seeding_trigger.sql`). Trigger calls `process_intake_seed`, which seeds project types, statuses, services, session types, packages, message templates, and workflows. Sample-data entity creation is stubbed for the next milestone.
6. **Localization:** confirm all seeded entity names/descriptions exist in both EN & TR (and future locales). Store copy in template tables so runtime seeding picks the correct locale (now captured via `organization_settings.preferred_locale`). *(Delivery-method + advanced workflow templates still outstanding.)*
7. ✅ **Sample data injection:** create localized leads/projects/sessions via `seed_sample_data_for_org` when users opt into sample data (`20260222135000_sample_data_seed.sql`).
8. **Monitoring:** add telemetry/logs for seeding success/failure.
9. **Lead roster expansion:** update `seed_sample_data_for_org` with the six-lead plan above, TR-first contact info, and `[Sample Data]` note prefixes.
10. **Project-type blueprints:** codify the slug-keyed blueprint map (project title, package, session type, stage) and ensure the seeder iterates over the user’s `preferred_project_types`.
11. **Communication fallback enforcement:** audit email templates, workflow copy, and seeded notes to guarantee Turkish text is available and used as the runtime fallback.

## Open Questions
- Exact copy/pricing for services, packages, and templates per locale.
- Whether seeded workflows should be auto-attached to existing leads/projects.
- How to handle duplicate seeding if a user reruns intake via debug.
- How many locales must we support at launch (EN + TR, others?).
- Where should we store locale-specific templates (SQL tables vs. JSON exports).
- Do we need more than four sample projects if a user selects many project types, or is the “first N types” rule sufficient?
