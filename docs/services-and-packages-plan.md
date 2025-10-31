# Services & Packages Revamp Plan

## Purpose
- Establish a coherent catalog for every sellable item (team coverage and deliverables) so packages and projects draw from a single source of truth.
- Introduce bundle tooling that aligns with real photographer offerings (base shoot + optional staff + albums/prints) without overwhelming the UI.
- Roll the new selection pattern into package authoring, the project wizard, and project detail editing so clients can add/remove services consistently.

## Goals & Constraints
- **Goals**
  - Classify catalog items into at least two lightweight types (`coverage`, `deliverable`) to clarify staffing vs. production items.
  - Keep the settings UI familiar while surfacing the new grouping and required metadata.
  - Enable packages to compose multiple catalog items (base, add-ons) with clear totals.
  - Upgrade project flows to support the new line-item selector, ready for quantities and duplicates.
- **Constraints**
  - First iteration stays simple: no advanced pricing tiers or scheduling logic yet.
  - Respect current Supabase schema; any new columns or tables require coordination but aim for additive changes.
  - Avoid regressing existing catalog management or project creation during rollout—feature-flag where needed.

## Phase 1 — Reshape Service Catalog
- **Data design**
  - Add a `service_type` (enum/string) and optional metadata fields (`is_people_based`, `default_unit`) to `services`.
  - Prepare migration + backfill script (default existing services to `deliverable` unless labeled otherwise).
- **UI & UX**
  - Update Settings → Services to present segmented filters or tabs (Coverage vs Deliverables) with concise descriptions.
  - Keep the create/edit form nearly identical; only expose new fields when relevant so we avoid intimidating users.
  - Add guidance text and empty states that mention common Turkish photographer examples (second shooter, album, 10-print pack).
- **Tech tasks**
  - Extend hooks/services fetching to include the new fields.
  - Adjust tests and fixtures to cover both types.
- **Output**
  - A catalog that clearly differentiates people-based services from deliverables, ready for reuse elsewhere.

## Phase 2 — Bundle Authoring for Packages
- **Catalog integration**
  - Update package dialogs to consume the enriched service data.
  - Introduce a simple bundle builder: select a base service, then add optional coverage/deliverable items.
- **UX updates**
  - Show selected items as a list with grouping badges and individual prices; keep duplication disabled for now.
  - Provide a lightweight total calculator so users see package pricing clarity.
- **Tech tasks**
  - Share a new `ServiceLineItems` state shape (`serviceId`, `quantity?`, `unitPrice?`) even if quantity defaults to 1.
  - Ensure package previews in the wizard and project detail reuse this structure.
  - Update Supabase persistence to store the ordered list; remain backward compatible with existing data until migration completes.
- **Output**
  - Packages reflect real-world combinations (base shoot + album + print pack) and seed the upcoming project flow updates.

## Phase 3 — Revamp Project Service Selection
- **Project creation wizard**
  - Replace the current `ServicePicker` usage with the line-item selector, enabling separate coverage/product listings and future duplicate support.
  - Keep the wizard UX minimal: quick add buttons, summary chips, totals.
- **Project detail sheet**
  - Mirror the same selector for post-creation edits so teams can add more items later.
- **Migration considerations**
  - Provide auto-conversion for existing project services into the new structure (each becomes a line item with quantity 1).
  - Add analytics/telemetry to monitor adoption and errors.
- **Output**
  - All project entry points share the same intuitive selection model, ready for future enhancements (quantity steppers, notes).

## Parallel Tracks & Guardrails
- **Research & validation**
  - Quick interviews with 2–3 photographers to confirm the catalog split and bundle pattern feels natural.
  - Validate wording (TR/EN) for new UI labels before implementation.
- **Documentation & QA**
  - Update help docs/tooltips describing coverage vs deliverable.
  - Expand Jest/UI tests to cover both service types and the new package builder interactions.
  - Maintain feature flags or staged rollout to prevent regressions during migration.

## Tracking & Follow-ups
- Backfill existing services with the new `service_type` + staffing metadata so coverage items land in the correct tab.
- Audit package and wizard consumers to ensure service loading remains stable, then plan their migrations onto the line-item editor.
- Monitor Supabase queries for any places that still assume a flat list of services (e.g. reports) and update them to read the new columns.

## Immediate Next Steps
1. Review this plan with product/design to confirm scope and level of complexity.
2. Draft the service schema change (ERD snippet + migration checklist) and run it past backend.
3. Wireframe the updated settings catalog screens and bundle builder for quick validation.
4. Schedule implementation tasks per phase, aligning with ongoing work on the project wizard.
