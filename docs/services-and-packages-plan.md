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

## Phase 1 — Reshape Service Catalog *(in progress)*
- **Data design**
  - ✅ Added `service_type` + `is_people_based` to `services` (UI is consuming both the segmented filters and new dialogs).
  - ✅ Prepare migration + backfill script so existing rows pick the right type and staffing flag (`supabase/migrations/20251107120000_services_backfill_types.sql` drafted; QA + rollout checklist pending).
  - ✅ Decision: keep the `default_unit` column in the schema but defer exposing it in v1—line-item work will revisit once package quantity pickers land.
- **UI & UX**
  - ✅ Services settings now use the segmented control (coverage vs deliverable) and refreshed cards/dialog copy.
  - ✅ Dialogs expose the new fields only when relevant and include empty-state guidance.
- **Tech tasks**
  - ✅ Hooks/tests updated to return the new columns.
  - ⏳ Audit downstream consumers (packages, project flows, reports) to ensure they tolerate the richer payload.
- **Output**
  - Catalog UI differentiates staffing vs deliverables; backfill + consumer audit remain before closing the phase.

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
- 🚧 Run and verify the new backfill migration (`supabase/migrations/20251107120000_services_backfill_types.sql`) before enabling the segmented UI for all orgs. *(pending QA/deployment)*
- Audit package and wizard consumers to ensure service loading remains stable, then plan their migrations onto the line-item editor. *(pending)*
- Monitor Supabase queries for any places that still assume a flat list of services (e.g. reports) and update them to read the new columns. *(pending)*

## Immediate Next Steps
1. Review this plan with product/design to confirm scope and level of complexity. *(todo)*
2. Walk backend through the new schema additions + backfill heuristics so we have agreement on rollout sequencing and QA steps. *(todo)*
3. Wireframe the bundle builder experience (packages + project flows) using the new line-item pattern. *(todo)*
4. Schedule implementation tasks per phase, aligning with ongoing work on the project wizard. *(todo)*
