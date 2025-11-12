# Locale-Aware Seeding Plan

## Objectives
- Provide localized default data (lead statuses, project stages, session stages, project types, packages, services, delivery methods, email templates, workflows, etc.) when new organizations are created.
- Keep seeding logic transactional and maintainable within Supabase SQL helpers while allowing localized datasets to be expanded without code changes.
- Avoid duplication by defining a single authoritative source that can feed both SQL seeding functions and optional JSON exports.

## Current State
- Defaults for statuses, project types, packages, and services are hard-coded in helper functions such as `ensure_default_lead_statuses_for_org`, `ensure_default_project_statuses_for_org`, and `ensure_default_packages_for_org`.
- A subset of catalog data (services, packages, delivery methods) is duplicated in JSON under `supabase/seed/`, mainly for reference.
- Organization bootstrap logic (`handle_new_user_organization` and related triggers) calls the helpers without any locale context, so every org receives the same English defaults.
- Working hours appear to be seeded today, but we need to confirm the helper still runs and exposes localized day labels.

## Always-On Seeds (Independent of Sample-Data Flag)
These defaults must exist for every org immediately after creation, regardless of the intake toggle:

1. **Working hours**
   - Verify current helper. Default schedule proposal: Mon–Fri 09:00–18:00, Sat 10:00–15:00, Sun closed.
   - Times must respect the org’s timezone and locale-specific week start.

2. **Notification settings**
   - Set daily summary to enabled and schedule it for 09:00 local time.
   - Disable project milestone notifications by default; leave global notifications as-is.
   - Store the preference in whichever table (`organization_settings` or `notification_preferences`) already holds these toggles.

3. **Regional settings**
   - Auto-fill currency, date/time formats, number separators, etc., from the resolved locale.
   - Fallback should default to Turkish conventions (`tr-TR`) when locale detection fails.

4. **Project stages**
   - Photographer-centric flow with explicit lifecycle metadata (initial / positive terminal / negative terminal) and a palette that includes yellow:
     1. Planned – dark gray (`lifecycle=initial`).
     2. Proposal Sent – amber/yellow (`#EAB308`).
     3. Contract Signed – green.
     4. In Progress – purple (`#A855F7`).
     5. Completed – deep green (`lifecycle=positive_terminal`).
     6. Cancelled – red (`lifecycle=negative_terminal`).
   - Remove the old Inquiry/Delivered stages; rely on this leaner set and color tokens available in the UI picker.

5. **Session stages**
   - Lifecycle-aware and color-diverse (include yellow):
     1. Planned – gray (`initial`).
     2. Scheduled – cyan.
     3. Preparing – amber/yellow.
     4. In Progress – violet.
     5. Completed – green (`positive_terminal`).
     6. Cancelled – red (`negative_terminal`).

6. **Lead statuses**
   - Recommended flow with lifecycle metadata and yellow usage:
     1. New – gray (`initial`).
     2. Qualified – amber/yellow.
     3. Proposal Sent – blue.
     4. Negotiation – purple.
     5. Won – green (`positive_terminal`).
     6. Lost – red (`negative_terminal`).

7. **Project types**
   - Seed a localized baseline set for every org during bootstrap (independent of the intake flag) so reporting/configs always have defaults.
   - After the intake form, merge the user’s ordered selections into the same dataset (overwrite or append), ensuring the org always has at least the intake-driven types even if sample data is disabled.

> **Note:** “Sample data” (leads, projects, sessions, services, packages, etc.) remains conditional on the intake preference, but all items listed above are seeded unconditionally.

## Target Architecture

### Template Tables
- Introduce normalized template tables that hold localized defaults, e.g.:
  - `default_lead_status_templates(locale text, slug text, name text, color text, sort_order int, lifecycle text, is_default bool, is_system_required bool, is_system_final bool)`
  - `default_project_status_templates(locale text, slug text, name text, color text, sort_order int, lifecycle text, is_system_required bool)`
  - `default_session_status_templates(locale text, slug text, name text, color text, sort_order int, is_system_initial bool)`
  - `default_service_templates(locale text, slug text, name text, description text, category text, cost_price numeric, selling_price numeric, price numeric, extra boolean, is_sample boolean)`
  - `default_package_templates(locale text, slug text, name text, description text, price numeric, applicable_types text[], line_items jsonb, default_add_on_slugs text[], is_active bool)`
  - `default_delivery_method_templates(locale text, slug text, name text, description text)`
  - `default_email_template_templates(locale text, slug text, subject text, body text, category text, is_active bool)`
  - `default_workflow_templates(locale text, slug text, name text, description text, trigger text, definition jsonb, is_active bool)`
- Seed those tables with English entries plus localized entries (e.g., Turkish) inside migrations. Use stable `slug` values to keep relationships resolvable regardless of locale.

### SQL Helper Updates
- Update each `ensure_default_*` helper to accept a `locale text` argument (default `'en'`).
- Inside the helpers, query the corresponding template table filtered by the requested locale; fall back to the default locale if the requested one has no rows.
- When building packages, map `default_add_on_slugs` to actual service IDs by joining the service templates on `slug`.
- Keep helpers idempotent by checking whether localized records already exist before inserting.
- Add coverage for working hours, notification defaults, and regional settings so they follow the same template-driven approach (or document why they remain hard-coded).

### Locale Selection
- Extend organization bootstrap logic to determine the preferred locale when creating defaults:
  - Primary source: owner’s entry in `user_language_preferences`.
  - Secondary fallback: a new `preferred_locale` column in `organization_settings` or the system default (`'en'`).
- Pass the resolved locale into every `ensure_default_*` call (`handle_new_user_organization`, `ensure_default_*_for_org` triggers, and any manual reseed utilities).

### JSON Seed Files
- Option A: Deprecate JSON references and rely solely on template tables.
- Option B: Generate locale-specific JSON files from the template tables via a script so they remain mirrors of the canonical data (e.g., `supabase/seed/{locale}/services.json`). The script can run as part of CI or a manual command.
- Document whichever option we choose to avoid future drift.

## Implementation Phases
1. **Schema Setup**
   - Create template tables with appropriate constraints (`PRIMARY KEY` on `(locale, slug)`).
- Seed English and Turkish defaults in migrations. Ensure email templates/workflows include localized copy and trigger definitions that align with existing automation.
2. **Helper Refactor**
   - Update SQL helper signatures and logic to read from template tables and accept locale parameters.
   - Adjust triggers and RPC calls (`handle_new_user_organization`, migration backfills, CLI utilities) to forward locale values.
3. **Locale Resolution**
  - ✅ Capture preferred locale on `organization_settings` via intake (`preferred_locale` column, migration `20260222110000`).
  - Provide backfill (if needed) to align existing orgs, then call helpers to ensure data matches the template.
4. **JSON Strategy**
   - Decide on Option A or B above.
   - If keeping JSON, add a generation script (e.g., Deno/Node script or Supabase SQL export) and document how to run it.
5. **Testing and Verification**
   - Add integration tests (or SQL unit tests) to verify that `ensure_default_*` functions insert locale-specific data and remain idempotent.
   - Add regression checks ensuring package/service relationships resolve correctly for every locale.

## Open Questions
- Do we need per-tenant overrides or only language-based defaults?
- Which locales must ship in the first iteration beyond English and Turkish?
- Are there downstream systems (e.g., marketing site or onboarding scripts) consuming the JSON files that must be updated simultaneously?
- Should we expose localized defaults in the UI for editing, and how do edits sync back into templates?
- For working hours and notification schedules, do we allow per-user overrides during onboarding or only org-level defaults?
- How do we guarantee consistent color usage when users later customize stages—do we lock colors or simply seed suggestions?

## Next Actions
- Confirm the target locale list and finalize template schemas.
- Decide on JSON retention strategy (generate vs. remove).
- Create the initial migration to add template tables and seed English/Turkish data.
- Schedule helper refactor and migration backfill work once schema is in place.
