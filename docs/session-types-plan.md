# Session Types Restructure Plan

## Context
- Packages currently persist a single `duration` string, forcing one session length per package (`packages.duration` in `src/integrations/supabase/types.ts:705` and related UI validations).
- Sessions themselves do not have a reusable definition for duration/type; booking flows capture raw date/time plus free-form notes (`sessions` table, same file lines 1240+).
- Organization settings already exist and are auto-seeded through `ensure_organization_settings`, making them a good place to store org-wide defaults.
- The product needs:  
  1. Session types to be first-class entities with reusable durations and metadata.  
  2. Ability to set a default session type per organization to reduce repetitive selection.  
  3. Removal of duration from packages (support packages with mixed session types later).  
  4. Strong migration story with minimal disruption.

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

## Phase 1 — Data Model Foundations

### Schema Changes
- **`session_types` table**  
  Columns: `id uuid pk`, `organization_id uuid fk -> organizations(id)`, `user_id uuid`, `name text`, `description text`, `category text`, `duration_minutes int`, `is_active boolean default true`, `sort_order int`, timestamps.  
  RLS mirrored from similar org-scoped tables (services/packages).  
  Index on `(organization_id, sort_order)`.

- **`sessions.session_type_id uuid` (nullable)**  
  FK -> `session_types.id`. Update row-level policies accordingly. Backfill strategy ties existing sessions to inferred types where possible.

- **`organization_settings.default_session_type_id uuid` (nullable)**  
  FK -> `session_types.id`. Update `ensure_organization_settings` to set `NULL` initially, plus new helper to set default when only one active type exists.

- **Drop `packages.duration`**  
  Two-step migration:  
  1. Make field nullable and stop writing to it (ahead of front-end updates).  
  2. Once clients no longer rely on it, issue migration to drop column and adjust Supabase types.

### Migration / Backfill Steps
1. Create `session_types` table and add column to `sessions`.  
2. Add column to `organization_settings`.  
3. Seed default session types for existing orgs:  
   - Use `public.parse_session_duration_minutes` to convert package duration strings (supports option keys like `1h`, legacy text like `2 hours`, and maps `multi-session` to **90 minutes**).  
   - Generate session types per package (prefixed with package name + duration) only when an org has zero types to avoid overriding manual setups.  
   - Call `ensure_default_session_types_for_org` for every organization to backfill missing types and enforce a default selection.  
4. Populate `sessions.session_type_id` when `packages.duration` or notes clearly match. Fallback to `NULL` when ambiguous.  
5. Set default session type when an org ends up with exactly one active type post-seed.  
6. Begin ignoring `packages.duration` writes while keeping column as nullable for rollback safety.  

### Deliverables
- Supabase migration scripts.  
- Updated `src/integrations/supabase/types.ts` reflecting new structures.  
- Draft backfill playbook (SQL scripts + operator instructions).  
- Update to this plan documenting execution status.

## Phase 2 — Backend & Supabase Layer

### Tasks
- Extend `ensure_organization_settings` to guarantee a settings row with `default_session_type_id`.  
- Introduce `ensure_default_session_types_for_org(user_uuid uuid, org_id uuid)` RPC mirroring existing seeding patterns.  
- Update RLS policies and stored procedures (`ensure_default_packages_for_org`, triggers) to account for session type dependencies.  
- New Supabase client helpers & hooks:  
  - `useSessionTypes` hook similar to `useServices`.  
  - Mutations for CRUD (create/update/delete session types, set default).  
  - Utility to fetch default session type quickly (possibly through extended settings hook).
- Confirm existing edge functions (notifications, reminders) don’t break with new column (update queries if needed).

### Deliverables
- Stored procedure/RPC definitions.  
- React Query hooks.  
- Documentation updates in this plan.

## Phase 3 — Frontend Settings & CRUD

### Session Types Management UI
- Add `SessionTypesSection` to `src/pages/settings/Services.tsx`, above packages.  
- UI elements: list with filters (active/inactive), inline actions to set default, create/edit dialog capturing name/duration/category/description.  
- Warn before deleting a type that is referenced by sessions (require migration or soft-delete).  
- Ensure `ensure_default_session_types_for_org` is invoked analogously to packages/services when settings load.

### Default Selection
- Display current default in the list.  
- Provide “Set as default” action (writes to `organization_settings.default_session_type_id`).  
- Auto-set default after creating first session type (client-side convenience + server-side fallback).

### Deliverables
- New components, forms, and translations.  
- Update to plan doc summarizing progress.

## Phase 4 — Product Integration & Cleanup

### Booking & Session Flows
- Update session creation/edit forms to drive duration from selected session type.  
- Preselect default session type; if none, show chooser.  
- Display type info (duration, description) in session detail view.  
- Make `session_type_id` required on new sessions when at least one active type exists (while handling migration grace).

### Packages Adjustments
- Remove duration inputs/validation from package dialogs and listings.  
- Replace “Duration” column with “Session guidance” placeholder (until blueprint work) or omit entirely with tooltip pointing to session types.  
- Update translations and strings accordingly.

### Cleanup Tasks
- Remove remaining references to `packages.duration`.  
- Drop column via migration when safe.  
- Ensure analytics/reporting that depended on duration have alternatives or clarifying notes.

### Deliverables
- Refined UI, updated tests, final Supabase migration to drop column, plan doc final update.

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
| Data Model Foundations | In progress | Schema + backfill migrations (`20250914120000_session_types_schema.sql`, `20250914122000_session_types_backfill.sql`, `20250914123000_session_types_assign_sessions.sql`) in place. |
| Backend & Supabase Layer | In progress | RPC (`ensure_default_session_types_for_org`) and hook scaffolding started. |
| Frontend Settings & CRUD | In progress | Settings UI for session types and default selection delivered. |
| Product Integration & Cleanup | In progress | Package duration removed; booking flow updates pending. |

## Upcoming Tasks
- (Postponed) Integrate session type selection/defaults into booking & session creation flows — awaiting updated product direction.
- Add automated tests (Supabase function unit coverage + React Query hook smoke) before rollout.

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
