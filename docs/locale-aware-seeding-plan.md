# Locale-Aware Seeding Plan

## Objectives
- Provide localized default data (lead statuses, project stages, session stages, project types, packages, services, delivery methods, email templates, workflows, etc.) when new organizations are created.
- Keep seeding logic transactional and maintainable within Supabase SQL helpers while allowing localized datasets to be expanded without code changes.
- Avoid duplication by defining a single authoritative source that can feed both SQL seeding functions and optional JSON exports.

## Current State
- Defaults for statuses, project types, packages, and services are hard-coded in helper functions such as `ensure_default_lead_statuses_for_org`, `ensure_default_project_statuses_for_org`, and `ensure_default_packages_for_org`.
- A subset of catalog data (services, packages, delivery methods) is duplicated in JSON under `supabase/seed/`, mainly for reference.
- Organization bootstrap logic (`handle_new_user_organization` and related triggers) calls the helpers without any locale context, so every org receives the same English defaults.

## Target Architecture

### Template Tables
- Introduce normalized template tables that hold localized defaults, e.g.:
  - `default_lead_status_templates(locale text, slug text, name text, color text, sort_order int, lifecycle text, is_default bool, is_system_required bool, is_system_final bool)`
  - `default_project_type_templates(locale text, slug text, name text, sort_order int, is_default bool)`
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
- Seed English and Turkish defaults in a migration. Ensure email templates/workflows include localized copy and trigger definitions that align with existing automation.
2. **Helper Refactor**
   - Update SQL helper signatures and logic to read from template tables and accept locale parameters.
   - Adjust triggers and RPC calls (`handle_new_user_organization`, migration backfills, CLI utilities) to forward locale values.
3. **Locale Resolution**
- Add or update logic to capture each organization’s preferred locale (via user preference lookup or organization settings).
  - Provide migration/backfill to assign a default locale (`'en'`) for existing organizations, then call helpers to ensure data matches the template.
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

## Next Actions
- Confirm the target locale list and finalize template schemas.
- Decide on JSON retention strategy (generate vs. remove).
- Create the initial migration to add template tables and seed English/Turkish data.
- Schedule helper refactor and migration backfill work once schema is in place.
