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
   - Use `packages.duration` + package names as hints.  
   - If multiple packages share duration, dedupe to a single type (e.g., map `"3h"` → “3 Hour Session”).  
   - Record mapping in temp table/log to review conflicts (document residual manual steps).  
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

