# Session Types Restructure Plan

## Context
- Legacy packages persisted a single `duration` string, forcing one session length per package. This column is now removed via `20250914140500_remove_packages_duration.sql`, but the constraint motivated the restructure.
- Sessions themselves still lack a reusable definition for duration/type; booking flows capture raw date/time plus free-form notes (`sessions` table, `src/integrations/supabase/types.ts:1287`), so downstream UI continues to rely on legacy heuristics.
- Organization settings already exist and are auto-seeded through `ensure_organization_settings`, making them a good place to store org-wide defaults.
- The product needs:  
  1. Session types to be first-class entities with reusable durations and metadata.  
  2. Ability to set a default session type per organization to reduce repetitive selection.  
  3. Removal of duration from packages (support packages with mixed session types later).  
  4. Strong migration story with minimal disruption.
- **Current status (2025-10-25):** Database migrations, generated Supabase types, and Settings UI ship without feature flags. Booking flows and session detail surfaces still operate on legacy fields until the new relations are wired end to end.

## Goals
- Create a maintainable session type system decoupled from packages.
- Support an organization-level default session type (auto-applied during session creation when unambiguous).
- Remove the hard-required duration field from packages’ schema and UI.
- Seed sensible defaults for new organizations (and backfill existing ones where possible).
- Document progress in this plan after each implementation slice.

## Non-Goals
- Introducing a `package_sessions` linkage table (blueprint) in this iteration.
- Reworking scheduling UX beyond selecting a session type + start/end time.
- Changing project/package pricing logic.

## Operational Notes (Codex Rules Snapshot)
- Changing Supabase edge functions requires post-merge deploy: `npx supabase login`, `npx supabase link --project-ref rifdykpdubrowzbylffe`.
- Respect i18n guidelines—no hardcoded copy; update EN/TR locales with UI changes.
- All repo-altering tasks finish with a single-line commit summary (per `.codex/rules.md`).
- Deliver production-quality solutions with automated tests where feasible and document any manual verification.

## High-Level Phases
1. **Data Model Foundations**  
   Create database structures and migrations for session types and default selections. Include backfill strategy and feature parity safeguards.
2. **Backend & Supabase Layer**  
   Update Supabase types, RPC helpers, and seeding logic (`ensure_*` functions) to expose session types and defaults.
3. **Frontend Settings & CRUD**  
   Build Session Types management UI in settings (list, add, edit, delete) and integrate with organization defaults.
4. **Product Integration & Cleanup**  
   Remove package duration usage, update booking forms/dialogs, ensure default session type auto-selection, and finalize documentation/tests.

Each phase can be delivered incrementally; this document will track completed steps and remaining work.

---

## Current Snapshot (2025-10-25)
- Supabase migrations `20250914120000_session_types_schema.sql`, `20250914122000_session_types_backfill.sql`, `20250914123000_session_types_assign_sessions.sql`, and `20250914140500_remove_packages_duration.sql` are merged and reflected in `src/integrations/supabase/types.ts`.
- `ensure_default_session_types_for_org` seeds defaults and is invoked by `OrganizationContext` and `useSessionTypes`; generated Jest coverage in `src/hooks/__tests__/useOrganizationData.test.ts` verifies caching semantics.
- Settings now render `SessionTypesSection` with `SessionTypeDialogs`, locale coverage (EN/TR), default toggles, and delete confirmations, plus unit tests in `src/components/settings/__tests__/SessionTypeDialogs.test.tsx` and `src/components/__tests__/SessionTypesSection.test.tsx`.
- Scheduling flows (`useSessionForm`, `SessionSchedulingSheet`) and session detail views still write/read legacy fields; they need to adopt `session_type_id` before GA.

## Phase 1 — Data Model Foundations

**Status:** Completed (2025-09-15)

### Schema Changes
- **`session_types` table** — ✅ Landed in `20250914120000_session_types_schema.sql` with RLS mirroring service/package tables, plus sort-order and active indexes.
- **`sessions.session_type_id uuid` (nullable)** — ✅ Added in the same migration with FK + index, ready for gradual adoption in booking tooling.
- **`organization_settings.default_session_type_id uuid` (nullable)** — ✅ Added with FK/index; defaults applied by `ensure_default_session_types_for_org`.
- **Drop `packages.duration`** — ✅ Completed in `20250914140500_remove_packages_duration.sql` after front-end cleanup; regenerate Supabase types to remove stale properties.

### Completed Work
- Created `session_types` schema, triggers, policies, and indexes (`20250914120000_session_types_schema.sql`).
- Seeded and backfilled defaults through `ensure_default_session_types_for_org` (`20250914121000_session_types_defaults.sql`) and parsing/backfill helpers (`20250914122000_session_types_backfill.sql`).
- Populated existing sessions with organization defaults (`20250914123000_session_types_assign_sessions.sql`).
- Dropped `packages.duration` and refreshed default package seeding helpers to remove duration assumptions (`20250914140500_remove_packages_duration.sql`).
- Regenerated TypeScript definitions in `src/integrations/supabase/types.ts` to surface `session_types` tables and strip `packages.duration`.

### Migration / Backfill Steps
- [x] Create `session_types` table and add column to `sessions`.  
- [x] Add column to `organization_settings`.  
- [x] Seed default session types for existing orgs using `public.parse_session_duration_minutes` + `ensure_default_session_types_for_org`.  
- [x] Populate `sessions.session_type_id` when defaults exist; leave ambiguous rows as `NULL`.  
- [x] Set default session type when an org ends up with exactly one active type post-seed.  
- [x] Stop writing to (and ultimately drop) `packages.duration`.

### Deliverables
- Supabase migration scripts ✅  
- Updated `src/integrations/supabase/types.ts` reflecting new structures ✅  
- Draft backfill playbook (SQL scripts + operator instructions) ➡️ TODO to stage before production dry run  
- Update to this plan documenting execution status ✅

## Phase 2 — Backend & Supabase Layer

**Status:** In progress — core RPCs and hooks shipped; edge function audit + Supabase tests pending.

### Tasks
- [x] Extend `ensure_organization_settings` to guarantee a settings row with `default_session_type_id`.  
- [x] Introduce `ensure_default_session_types_for_org(user_uuid uuid, org_id uuid)` RPC mirroring existing seeding patterns.  
- [x] Update RLS policies and stored procedures (`ensure_default_packages_for_org`, triggers) to account for session type dependencies.  
- [x] Ship Supabase client helpers & hooks (`useSessionTypes`, settings prefetch).  
- [ ] Confirm existing edge functions (notifications, reminders) don’t break with new column (update queries if needed) and produce regression tests.

### Deliverables
- Stored procedure/RPC definitions.  
- React Query hooks.  
- Documentation updates in this plan.

### Completed Work
- Added `ensure_default_session_types_for_org` (20250914121000) and wired it into organization prefetch + hook layer with Jest coverage (`src/hooks/__tests__/useOrganizationData.test.ts`).
- Prefetches now run through `OrganizationContext` to guarantee defaults before rendering dependent UI.
- `useSessionTypes` exposes normalized access; new tests cover query key composition and RPC invocation.
- CRUD paths (create/update/delete/default) live inside `SessionTypeDialogs`/`SessionTypesSection`, each calling Supabase directly with optimistic cache invalidation.

### Outstanding
- Audit Supabase edge functions (notifications, reminder processors, calendar sync) for reliance on legacy duration fields; update queries or fallbacks to leverage `session_type_id`.
- Add targeted Supabase tests (e.g., Deno tests mirroring `ensure_default_session_types_for_org`) once schema stabilizes.

## Phase 3 — Frontend Settings & CRUD

**Status:** Completed (2025-10-25) — need to add guardrails before deleting in-use types.

### Session Types Management UI
- [x] Add `SessionTypesSection` to `src/pages/settings/Services.tsx`, above packages.  
- [x] UI elements: list with filters (active/inactive), inline actions to set default, create/edit dialog capturing name/duration/category/description.  
- [ ] Warn before deleting a type that is referenced by sessions (require migration or soft-delete).  
- [x] Ensure `ensure_default_session_types_for_org` is invoked analogously to packages/services when settings load.

### Default Selection
- [x] Display current default in the list.  
- [x] Provide “Set as default” action (writes to `organization_settings.default_session_type_id`).  
- [x] Auto-set default after creating first session type (server fallback + UI toggle).

### Completed Work
- Built `SessionTypesSection` with create/edit/delete/default actions, duration formatting, and empty-state guidance.
- Implemented `SessionTypeDialogs` with validation, `set as default` toggle, `is_active` switch, and translation coverage (EN/TR).
- Integrated section into Settings Services page and added Jest tests (`src/components/__tests__/SessionTypesSection.test.tsx`, `src/components/settings/__tests__/SessionTypeDialogs.test.tsx`).
- Updated settings data prefetch + React Query cache invalidation to keep list in sync after mutations.

### Outstanding
- Block deletion (or convert to `is_active` toggle only) when Supabase reports existing `sessions.session_type_id` references; surface actionable messaging in UI.
- Revisit filtering (active/inactive toggle) once usage data arrives.

### Deliverables
- New components, forms, and translations.  
- Update to plan doc summarizing progress.

## Phase 4 — Product Integration & Cleanup

**Status:** In progress — package cleanup shipped; booking flows still rely on legacy fields.

### Booking & Session Flows
- [ ] Update session creation/edit forms to capture `session_type_id` and derive duration metadata.  
- [ ] Preselect default session type; if none, show chooser.  
- [ ] Display type info (duration, description) in session detail view (`SessionSheetView`, `SessionDetail`).  
- [ ] Make `session_type_id` required on new sessions when at least one active type exists (while handling migration grace).

### Packages Adjustments
- [x] Remove duration inputs/validation from package dialogs and listings (`src/components/settings/PackageDialogs.tsx`, `src/components/PackagesSection.tsx`).  
- [ ] Replace “Duration” column with contextual messaging/tooltip pointing to Session Types.  
- [x] Update translations and strings accordingly (EN/TR resources).

### Cleanup Tasks
- [x] Remove remaining code references to `packages.duration`.  
- [x] Drop column via migration (`20250914140500_remove_packages_duration.sql`).  
- [ ] Ensure analytics/reporting/notifications that depended on duration have alternatives or clarifying notes (pending audit alongside booking updates).

### Completed Work
- Package dialogs and listings no longer surface duration; user education points to Session Types instead of duplicating fields.
- Supabase types, generated hooks, and Jest coverage were refreshed to reflect the new schema.
- Added smoke tests for scheduling UI to guarantee existing behaviour while session types remain optional.

### Outstanding
- Wire `useSessionForm`, `ScheduleSessionDialog`, and related services to write `session_type_id`, leveraging defaults when present.
- Update session detail, calendar, and notification surfaces to reference `session_types` instead of project type fallbacks.
- Provide deletion guardrails once sessions start referencing types (ties back to Phase 3 outstanding item).
- Document migration/backfill verification steps and rollout checklist before enabling enforcement.

### Deliverables
- Refined UI, updated tests, final Supabase migration to drop column ✅  
- Booking flow integration, notification updates, and rollout documentation ➡️ pending

---

## Testing & Validation Strategy
- **Backend**: migration dry-runs on staging snapshot; Supabase test harness for new RPCs; RLS tests ensuring only org members access their session types.  
- **Frontend**: unit tests for new hooks and components; Cypress/Playwright regression covering session creation defaults; manual smoke on packages/settings.  
- **Data Integrity**: pre/post migration reports (count of sessions without type, packages touched).  
- Update plan doc after each phase to record test outcomes.

## Open Questions / Follow-ups
- How aggressive should automated backfill be vs. manual review for existing sessions?  
- Naming conventions for auto-created session types (consider localization).  
- Do we need soft-delete for session types (to preserve history) or is hard delete acceptable with referential constraints (might require `is_active` toggle only)?

## Tracking
- This document will be updated after each implementation pass with a change log, status table, and next steps.  
- Consider adding a lightweight checklist for each phase once work begins.

## Status
| Phase | Status | Notes |
| --- | --- | --- |
| Data Model Foundations | Completed | Migrations + Supabase types shipped (`20250914120000`, `20250914122000`, `20250914123000`, `20250914140500`). |
| Backend & Supabase Layer | In progress | `ensure_default_session_types_for_org` live; edge function audit + Supabase tests pending. |
| Frontend Settings & CRUD | Completed | `SessionTypesSection` + dialogs deployed with Jest/i18n coverage. |
| Product Integration & Cleanup | In progress | Package cleanup done; booking flows still using legacy fields. |

## Upcoming Tasks
- Wire `useSessionForm` / `SessionSchedulingSheet` / session edit flows to store `session_type_id`, applying organization defaults automatically.
- Update session detail, calendar, and notification surfaces to read/display session type metadata instead of project-type fallbacks.
- Add Supabase/Deno coverage for `ensure_default_session_types_for_org` and edge functions touching session data.
- Introduce deletion/inactivation guardrails when a session type is referenced by existing sessions.
- Draft rollout playbook: migration dry-run checklist, staging validation steps, operator comms.

## Iteration Log
- **2025-09-14** — Implemented Phase 1 schema migration and updated generated types. Added unique lower-name index, owner-only RLS, and default session-type FK.  
  - **Review**: Verified migration + type updates manually; ensured relationships align with single-owner model.  
  - **Testing**: No automated tests run (SQL + type update only). Manual review of diff completed.  
  - **Next**: Draft backfill scripts/plan and expand backend RPCs (`ensure_default_session_types_for_org`, settings default updates).
- **2025-09-14 (later)** — Added `ensure_default_session_types_for_org` seeding function and documented Codex operational rules. Seeds default “Signature Session” (90 min) and “Mini Session” (30 min); auto-populates organization default when unset.  
  - **Review**: Checked SQL for idempotency (guard on existing rows) and default assignment logic.  
  - **Testing**: Pending—will validate via Supabase migration dry-run before release; no automated tests added yet.  
  - **Next**: Wire new RPC into backend hooks and plan backfill migration for existing orgs/sessions.
- **2025-09-14 (evening)** — Added parsing/backfill migration `20250914122000_session_types_backfill.sql` and new React hook `useSessionTypes`. Legacy package durations are mapped to minutes (e.g., `half_day` → 240, `multi-session` → 90) before inserting org-scoped session types; defaults enforced via RPC loop.  
  - **Review**: Manually reviewed parsing heuristics and ensured `ON CONFLICT` avoids duplicate names.  
  - **Testing**: Not yet executed; will include Supabase migration dry-run and hook smoke test in upcoming validation pass.  
  - **Next**: Expose session types in settings UI, backfill session references, and begin removing package duration dependencies.
- **2025-09-14 (night)** — Assigned existing sessions to organization defaults via migration `20250914123000_session_types_assign_sessions.sql`. We run `ensure_default_session_types_for_org` per org, then populate `sessions.session_type_id` with the default (or first active type) when unset.  
  - **Review**: Confirmed migration no-ops if defaults already exist; avoids touching sessions where multiple active types exist but no default.  
  - **Testing**: Pending Supabase dry-run; manual logic check complete.  
  - **Next**: Implement settings UI and default selector, then remove package duration reliance.
- **2025-09-15** — Delivered settings management UI (list, CRUD dialogs, default selector) and translations; wired `useSessionTypes` into settings page. Added safeguards for deactivating defaults and extended toasts.  
  - **Review**: Manually exercised add/edit/delete/default flows in code review; confirmed translation coverage for EN/TR.  
  - **Testing**: UI not yet exercised end-to-end; plan to run manual smoke after frontend integration tests are available.  
  - **Next**: Finalize package duration removal and revisit session booking flow once new direction is defined.
- **2025-09-15 (afternoon)** — Removed package duration inputs/validation and pointed users to Session Types. Updated package dialogs, settings tables, and project dialogs; translations refreshed (EN/TR).  
  - **Review**: Verified Supabase inserts/updates now persist `NULL` duration and double-checked all UI surfaces render without duration fields.  
  - **Testing**: Pending manual smoke through Settings → Packages and project creation flow.  
  - **Next**: Validate DB migrations in staging and resume booking-flow work once product requirements settle.
- **2025-10-25** — Shipped full Session Types stack: Supabase migrations, `useSessionTypes`, `SessionTypesSection`/`SessionTypeDialogs`, package cleanup, and GitHub Actions/Jest coverage.  
  - **Review**: Validated migrations, Supabase type regeneration, and EN/TR locale updates alongside new settings UI flows.  
  - **Testing**: Ran Jest suites (new component, hook, service tests) and added CI workflow; Supabase migrations slated for staging dry-run.  
  - **Next**: Wire booking flows to `session_type_id` and audit edge functions/notifications.
- **2025-10-25 (midday)** — Simplified Session Types list UX, tightened default badge handling, and pruned redundant mocks.  
  - **Review**: Spot-checked updated `SessionTypesSection` interactions (set/clear default, edit, delete).  
  - **Testing**: Re-ran targeted Jest suites for settings modules.  
  - **Next**: Add deletion guard for in-use types and expose session type picker in scheduling UI.
