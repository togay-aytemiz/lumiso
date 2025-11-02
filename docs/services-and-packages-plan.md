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
  - Capture KDV (VAT) expectations per service so totals stay accurate whether prices are tax-inclusive or exclusive.
  - Provide organization-level tax + billing defaults so new services/packages start with the right KDV mode, rate, and invoice identity.
- **Constraints**
  - First iteration stays simple: no advanced pricing tiers or scheduling logic yet.
  - Respect current Supabase schema; any new columns or tables require coordination but aim for additive changes.
  - Avoid regressing existing catalog management or project creation during rollout—feature-flag where needed.
  - Apply KDV exactly once per line item; avoid double-charging when composing packages or overriding prices downstream.

## Phase 1 — Reshape Service Catalog *(in progress)*
- **Data design**
  - ✅ Added `service_type` + `is_people_based` to `services` (UI is consuming both the segmented filters and new dialogs).
  - ✅ Prepare migration + backfill script so existing rows pick the right type and staffing flag (`supabase/migrations/20251107120000_services_backfill_types.sql` drafted; QA + rollout checklist pending).
  - ✅ Decision: keep the `default_unit` column in the schema but defer exposing it in v1—line-item work will revisit once package quantity pickers land.
  - ✅ Introduce `vat_rate` (`numeric(5,2)`) and `price_includes_vat` (`boolean`, default `false`) on `services`, with `organization_settings.tax_profile` defaulting to **20%** KDV for new and existing orgs. Migration `20251109120000_services_vat_profile.sql` seeds the schema.
  - ✅ Extend `organizations` (or companion `organization_settings`) with `tax_profile` jsonb capturing billing identity + default KDV settings, including migration/backfill using the existing single KDV field when present. *(Migration + settings UI now populate defaults at 20% KDV.)*
  - ✅ Follow-up migration `20251109161000_tax_profile_defaults_include.sql` realigns defaults to VAT-inclusive pricing, backfills seeded sample services, and refreshes `ensure_default_services_for_org` so new orgs inherit their tax profile (20 % / include KDV) out of the box.
- **Organization settings**
  - ✅ Add a **Tax & Billing** section under organization settings so owners can define defaults once and reuse them across services/packages.
  - ✅ Fields: legal entity toggle (`Şahıs` vs `Şirket`), company name, tax office, VKN/TCKN, optional billing address, default KDV rate %, and whether catalog prices include KDV by default.
  - ✅ Surface helper text clarifying that defaults only pre-fill new services/packages; existing records keep their stored values until edited.
- **UI & UX**
  - ✅ Services settings now use the segmented control (coverage vs deliverable) and refreshed cards/dialog copy.
  - ✅ Dialogs expose the new fields only when relevant and include empty-state guidance.
  - ✅ Extend the service dialog pricing block with a "KDV" accordion: radio control for **Included in price** vs **Add on top** plus a numeric percentage input. Mirror copy in TR (`KDV fiyatın içinde` / `KDV ayrıca eklenecek`). Persist the choices to the new fields.
- **Tech tasks**
  - ✅ Hooks/tests updated to return the new columns.
  - ⏳ Audit downstream consumers (packages, project flows, reports) to ensure they tolerate the richer payload.
  - ✅ Normalize KDV math helpers (`calculateVatPortion`, `applyVat`) so both settings and package builders share a single implementation. Landed in `src/lib/accounting/vat.ts` and covered by unit tests/power the package wizard snapshot math.
  - ✅ Hydrate package wizard line items with the new service-level VAT defaults and organization tax profile so inclusive/exclusive math stays consistent.
  - ✅ Adopt the shared VAT helpers inside service dialogs/settings once the new schema fields exist so the settings UI and package wizard stay in sync.
  - ✅ Settings › Services listing now surfaces VAT %/amount and whether pricing includes KDV to help admins audit catalog data quickly.
  - 🚧 Extend `useOrganization` payload with `taxProfile` (entity type, names, identifiers, default `vatRate`, `vatMode`) sourced from the new settings screen. Ensure service/package forms hydrate from it while allowing per-item overrides.
- **Output**
  - Catalog UI differentiates staffing vs deliverables, Tax & Billing defaults are editable, and service dialogs now persist VAT metadata; backfill/consumer audit remain before closing the phase.

## Phase 2 — Bundle Authoring for Packages
- **Catalog integration**
  - Update package dialogs to consume the enriched service data.
  - Introduce a simple bundle builder: select a base service, then add optional coverage/deliverable items.
  - Pull `vat_rate` + `price_includes_vat` onto each line item so package totals reflect tax-inclusive vs exclusive items without double-counting.
- **UX updates**
  - Show selected items as a list with grouping badges and individual prices; keep duplication disabled for now.
  - Provide a lightweight total calculator so users see package pricing clarity.
  - Display KDV chips inline (e.g., `KDV %18 dahil` or `+%20 KDV`) and surface a summary row that breaks out subtotal, KDV total, and grand total.
- **Tech tasks**
  - Share a new `ServiceLineItems` state shape (`serviceId`, `quantity?`, `unitPrice?`) even if quantity defaults to 1.
  - Ensure package previews in the wizard and project detail reuse this structure.
  - ✅ Update Supabase persistence to store the ordered list (`packages.line_items` jsonb) and mirror legacy add-ons until front-end migration lands.
  - ✅ Extend the line item schema to `{ serviceId, quantity?, unitPrice?, vatRate, vatMode: 'included' | 'exclusive' }`, defaulting from the service record. Guard against adding organization-level KDV again at package submission.
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
  - Add QA scenarios for mixed KDV setups (all inclusive, all exclusive, and mixed) to ensure totals match manual calculations before launch.

## Tracking & Follow-ups
- 🚧 Run and verify the new backfill migration (`supabase/migrations/20251107120000_services_backfill_types.sql`) before enabling the segmented UI for all orgs. *(pending QA/deployment)*
- 🚧 Roll out the new `packages.line_items` column (`supabase/migrations/20251107133000_packages_line_items.sql`) and confirm seed helpers/backfill behave as expected in staging. *(pending QA/deployment)*
- 🚧 QA the new enrichment pass (`supabase/migrations/20251108134500_packages_line_items_enrich.sql`) that backfills `unitPrice`/VAT metadata onto existing package line items so staging totals match the wizard.
- ✅ VAT + tax profile schema migration (`supabase/migrations/20251109120000_services_vat_profile.sql`) verified in staging and applied to production on 2025-11-09; service inserts respect the new constraints.
- 🚧 QA & deploy the defaults alignment migration (`supabase/migrations/20251109161000_tax_profile_defaults_include.sql`). This also backfills seeded sample services and updates `ensure_default_services_for_org` to honour each org’s VAT defaults.
- Audit package and wizard consumers to ensure service loading remains stable, then plan their migrations onto the line-item editor. *(pending)*
- Monitor Supabase queries for any places that still assume a flat list of services (e.g. reports) and update them to read the new columns. *(pending)*

## Immediate Next Steps
1. Run `20251109161000_tax_profile_defaults_include.sql` through staging QA, then apply to production per the Supabase runbook so inclusive VAT defaults go live. *(todo)*
2. Review this plan with product/design to confirm scope and level of complexity. *(todo)*
3. Walk backend through the new schema additions + backfill heuristics so we have agreement on rollout sequencing and QA steps. *(todo)*
4. Wireframe the bundle builder experience (packages + project flows) using the new line-item pattern. *(todo)*
5. Schedule implementation tasks per phase, aligning with ongoing work on the project wizard. *(todo)*
