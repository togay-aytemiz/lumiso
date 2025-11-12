# Seeding After Intake Plan

## Goals
- Seed every newly onboarded workspace immediately after the intake form completes.
- Always create base configuration that matches the user’s selected project types.
- Respect the sample data toggle: project-type scaffolding happens for everyone, full demo data only when the user opts in.

## Entities To Seed When Sample Data Is Enabled

### Services (`/settings/services`)
- Maintain two categories (Crew, Deliverables).
- Add two services per category (total 4) with localized names/descriptions.
- Price points should be realistic (e.g., Crew: “Baş Fotoğrafçı” and “Asistan”; Deliverables: “Drone Çekimi”, “Fotoğraf Albümü” in TR, English equivalents in EN).
- Tag each service with the default project type for filtering.

### Packages (`/settings/services`, Packages section)
- Create two packages that bundle the seeded services.
  - Example: “Premium Düğün Paketi” (includes both crew services + album).
  - Example: “Mini Çekim Paketi” (assistant + digital deliverable).
- Associate each package with the first selected project type; optionally list alternates from the remaining selections.

### Session Types (`/settings/services`, Session Types section)
- Seed two types:
  1. “Standart Çekim” – duration 3 hours, description explaining typical coverage.
  2. “Mini Çekim” – duration 30 minutes, description clarifying it’s a short session.
- Do **not** include duration in the title; rely on the dedicated duration field.

### Leads / Projects / Sessions
- Create 3 leads.
- Each lead should have 1–2 linked projects (total 2–3 projects overall).
- Projects should:
  - Randomly pick from the selected project types (default type guaranteed at least once).
  - Attach one of the seeded packages.
  - Contain 1 scheduled session with times relative to `profile_intake_completed_at` (e.g., +3 days, +10 days) so nothing lands in the past.
  - Each session must use one of the seeded session types.
- Leads should show realistic statuses (e.g., “New inquiry”, “Proposal sent”), with localized labels per locale.

### Email Templates
- Add 2 templates (localized content):
  1. Session-created notification.
  2. Session reminder (3 days before).
- Include placeholders for session date/time and package details; mark both templates as active.

### Workflows
- Seed 2 active workflows per locale:
  1. New project workflow – triggers on project creation, sends localized session-created email + schedules tasks.
  2. Session reminder workflow – runs 3 days before each session, sends localized reminder email and optionally creates a follow-up task.
- Ensure workflows reference the seeded templates in the same locale.

## Entities To Seed For **Everyone**
- `organization_settings.preferred_project_types` (already captured via intake; always apply the ordered list).
- Service focus / defaults derived from the selected types.
- Locale-specific stage/status defaults (project, session, lead) and working-hours/notification settings.

## Outstanding Tasks
1. ✅ **Schema change:** add a boolean `seed_sample_data_onboarding` to `organization_settings` (migration `20260222100000`).
2. ✅ **Client update:** persist `wantsSampleData` into that column when intake finishes (`ProfileIntakeGate` updates).
3. ✅ **Preferred locale capture:** store `preferred_locale` on `organization_settings` (migration `20260222110000`) and send it from intake so templates can pick the right language.
4. ✅ **Localized templates:** add canonical service/package/session-type template tables + locale-aware helpers (migration `20260222114500`).
5. **Seeding engine:** write Supabase trigger or Edge Function to:
   - Run after intake completion.
   - Always set up project-type defaults.
   - Branch into full sample seeding only when the boolean is true.
6. **Localization:** confirm all seeded entity names/descriptions exist in both EN & TR (and future locales). Store copy in template tables so runtime seeding picks the correct locale (now captured via `organization_settings.preferred_locale`). *(Services/packages/session types done; email/workflow content still pending.)*
7. **Monitoring:** add telemetry/logs for seeding success/failure.

## Open Questions
- Exact copy/pricing for services, packages, and templates per locale.
- Whether seeded workflows should be auto-attached to existing leads/projects.
- How to handle duplicate seeding if a user reruns intake via debug.
- How many locales must we support at launch (EN + TR, others?).
- Where should we store locale-specific templates (SQL tables vs. JSON exports).
