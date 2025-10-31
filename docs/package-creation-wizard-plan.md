# Package Creation Wizard Plan

## Goal
Introduce a guided, multi-step experience for configuring packages that matches the quality of the existing project creation and session planning wizards. The wizard should encourage complete data entry, surface live pricing totals, and support ad-hoc service additions without leaving the flow.

## MVP Focus & Audience
- ⬜ **Primary user:** independent or small-studio Turkish photographers (weddings, engagements, corporate shoots) launching with minimal operational tooling.
- ⬜ **Currency & language:** default to TRY pricing, copy localized in EN/TR; avoid multi-currency or tax widgets in MVP.
- ⬜ **Complexity guardrails:** keep each step lightweight, avoid deep branching or advanced automations. Anything beyond core needs should be flagged as “post-MVP”.
- ⬜ **Common inclusions we should support out of the box:** second shooter, drone, video add-on, retouching, printed album, digital gallery delivery, USB handover.

## Prior Art To Reuse
- ⬜ **Wizard shell:** `ProjectCreationWizard` and `SessionPlanningWizard` already provide a responsive shell, progress tracking, and guard rails. We can lift the sheet wrapper, context pattern, and stepper layout.
- ⬜ **State management:** Both wizards rely on reducers + context providers under `features/<wizard>/state`. We can mirror that shape for packages (`PackageCreationProvider`, reducer, selectors, action hooks).
- ⬜ **Reusable UI elements:** `AppSheetModal`, segmented navigation, summary cards, alert guards, and shared form controls (`Input`, `Textarea`, `Switch`, `Command`, `Badge`, etc.) should be reused to keep UI consistent.
- ⬜ **Data fetching utilities:** `useServices`, `useOrganization`, price formatters, and telemetry helpers already exist and should be leveraged.

## Step Breakdown

### 1. Basics
- ⬜ **MVP fields:** package name, short description, applicable project/session types (multi-select), visibility toggle (active/inactive).
- ⬜ **Deferred (post-MVP):** marketing tags, color coding, internal notes.
- ⬜ **UX:** reuse `FormFieldCard` styling from project wizard details step; include validation states + inline hints. Keep form to a single column on mobile.
- ⬜ **Data:** initial reducer slice `basics` with `name`, `description`, `applicableTypeIds`, `isActive`. `status`/tags stay bool/array ready for later.

### 2. Services & Inclusions
- ⬜ **Service selection:** embed a searchable list of existing services (reuse service picker from `PackagesStep` in project wizard). Quantity control via `StepperInput` or plus/minus buttons.
- ⬜ **Quick add custom (MVP):** minimal inline form (name + selling price, optional cost) to capture ad-hoc items without leaving the flow. Default vendor blank. Later we can add “Save to catalog” toggle.
- ⬜ **Summary panel:** show running totals (cost, selling, margin) in TRY. Keep visuals simple (two stat chips) for MVP.
- ⬜ **Out of scope for MVP:** tiered pricing per service, time-based scheduling, automatic tax calculations.
- ⬜ **Units:** provide a unit selector (session, hour, day, item) seeded from the service catalog. Default to the service’s recommended unit so downstream flows know how to price overrides.
- ⬜ **State:** slice `lineItems` with `type` (`existing`/`custom`), `serviceId`, `name`, `unit`, `quantity`, `unitCost`, `unitPrice`.

### 3. Delivery
- ⬜ **Fields:** estimated photo count (single number with optional range toggle), delivery lead time (numeric value + unit select of `days` or `weeks`), delivery methods (chip selector with seeded options: Online Gallery, USB, Album). Allow users to add a custom method inline; persistence to shared catalog can wait for post-MVP.
- ⬜ **Components:** reuse `PillSelector`/`Badge` chips from session wizard for multi-select, `NumberInput` for counts.
- ⬜ **State:** slice `delivery` { `estimateType`, `countMin`, `countMax`, `leadTimeValue`, `leadTimeUnit`, `methods`, `customMethodDraft` }.
- ⬜ **Post-MVP:** courier tracking, staged deliveries, automatic reminders.

### 4. Pricing
- ⬜ **Fields:** package base price (manual input), auto services total (read-only), calculated subtotal (base + services), deposit configuration.
- ⬜ **Deposit controls:** segmented control for quick percentages (5, 10, 25, 50) plus toggle for custom percent or fixed TRY amount. Keep calculations simple (no tax). Percent should apply to subtotal (base + services) — confirm with Tayte before implementation.
- ⬜ **State:** slice `pricing` { `basePrice`, `depositMode`, `depositValue` }. Services total computed via selector from `lineItems`.
- ⬜ **Post-MVP:** currency conversion, payment schedule builder, discounts.

### 5. Summary
- ⬜ **Review:** render collapsible summary cards mirroring project wizard summary step: basics info, delivery details, line item table, pricing breakdown, validation warnings.
- ⬜ **Confirmation:** final CTA to create package, with "Edit" links jumping back to steps.
- ⬜ **MVP display hints:** highlight total price in TRY, show deposit due, and list deliverables/services in plain language. Avoid printable PDFs or customer-facing exports for MVP.

## Data Flow & Persistence
- ⬜ When submitting, create package record in `packages` table (fields: name, description, applicable types, visibility, delivery metadata, pricing).
- ⬜ Persist base price to `packages.price`, final client-facing total to `packages.client_total`, the inclusive/exclusive flag via `packages.include_addons_in_price`, and deposit settings inside `packages.pricing_metadata` (enable flag, mode, value, target).
- ⬜ Bulk insert line items into `package_services` / new `package_line_items` table including quick-add entries and their `unit` metadata (generate services if user opted to save to catalog).
- ⬜ Store delivery methods in existing catalog table (mirroring session planning) with `organization_id`.
- ⬜ Track analytics events per step using `trackEvent` (phase 2).

## Architecture Outline
1. `features/package-creation/`
   - ⬜ `components/PackageCreationWizard.tsx` for the stepper UI.
   - ⬜ `components/PackageCreationWizardSheet.tsx` handling modal lifecycle, guard dialog, submit.
   - ⬜ `context/PackageCreationProvider.tsx` providing reducer + actions.
   - ⬜ `state/packageCreationReducer.ts` defining slices for `basics`, `lineItems`, `delivery`, `pricing`, `meta`.
   - ⬜ `steps/BasicsStep.tsx`, `ServicesStep.tsx`, `DeliveryStep.tsx`, `PricingStep.tsx`, `SummaryStep.tsx`.
   - ⬜ `hooks/usePackageCreationActions.ts` etc.

2. Shared utilities for quantity handling, totals, and field validation.

3. Supabase interactions wrapped in `services/PackageCreationService.ts` to keep sheets lean.

## Implementation Phases
### Phase 0 – Plan & Alignment (now)
- ✅ Produce this plan, confirm MVP scope, gather answers to open questions.
- ✅ Outcome: clear list of requirements & decisions before writing code.

### Phase 1 – Skeleton & State (week 1)
- ✅ Create `features/package-creation/` folder with provider, reducer scaffolding, typed state slices (`basics`, `lineItems`, `delivery`, `pricing`, `meta`).
- ✅ Implement wizard shell using existing stepper + guard components, with placeholder step bodies.
- ✅ Hook sheet into Services/Packages settings entry point behind feature flag (hidden by default).
- ✅ Deliverables: navigation works (Next/Back), state resets, telemetry scaffolding ready.

### Phase 2 – Basics & Services (week 1-2)
- ✅ Build Basics step UI with validation, type multi-select (reuse combos from project wizard), visibility toggle.
- ✅ Implement Services & Inclusions step with service list (via `useServices`), quantity controls, running totals, and lightweight “quick add” custom item (state only).
- ✅ Compute totals in selectors, update step completion rules.
- ✅ Deliverables: user can configure basics + add line items; services step shows totals but doesn’t persist to Supabase yet.
- ✅ **Decision checkpoint:** requires confirmation on ad-hoc service behaviour (package-only vs save-to-catalog toggle).

### Phase 3 – Delivery & Pricing (week 2)
- ✅ Add Delivery step fields (photo count/range toggle, lead time value/unit, delivery method chips with inline add). Persist custom methods in state; migrations for stored list if required.
- ✅ Build Pricing step with base price input, auto services total (read-only), deposit selector (percent presets + custom percent/fixed). Confirm deposit calculation rule before coding.
- ✅ Create the Supabase migration (delivery method storage or supporting tables) at the start of this phase so UI work hooks into the new schema immediately.
- ✅ Deliverables: all wizard steps capture MVP data, computed summary state available.
- ✅ **Decision checkpoint:** delivery method persistence approach (reuse session table vs new field) + deposit calculation basis.

### Phase 4 – Summary & Submission (week 3)
- ✅ Compose Summary step with collapsible review cards, edit shortcuts, validation warnings.
- ✅ Implement submission pipeline: write package record, create line items, handle custom services (package-only for MVP), store delivery metadata.
- ✅ Add analytics events + success toast, closing behaviour.
- ✅ Deliverables: package creation end-to-end works in dev, error handling + loading states covered.
- ✅ **Decision checkpoint:** confirm no KDV/tax requirements before finalizing submission payload.

### Phase 5 – Polish & QA (week 3+)
- ✅ Localization (EN/TR), accessibility pass, responsive tweaks.
- ✅ Unit tests for reducer/actions, step validations; integration test covering happy path.
- ✅ Update docs, internal runbook, feature flag rollout plan.
- ✅ Deliverables: production-ready wizard ready for enablement once content validated.

### Phase 6 – Project Wizard Package Selection Enhancements (week 4)
- ⬜ Refresh the package selection step inside project creation to surface package cards, key inclusions, TRY totals (base + services), and deposit preview.
- ⬜ Allow photographers to toggle service inclusion per package, adjust quantities/units, and override prices inline without leaving the project flow. Persist overrides as project-scoped line items.
- ⬜ Add unit selector mirroring package wizard options so adjustments remain consistent. Default to package units and highlight any overrides before submission.
- ⬜ Display quantity badges alongside service names whenever quantity > 1 so photographers can spot multi-count inclusions at a glance.
- ⬜ Deliverables: project wizard reflects updated pricing summary, supports per-project overrides, and keeps the review step accurate.
- ⬜ **MVP rule:** always keep overrides scoped to the project; log a future enhancement to push changes back into the base package if we support multi-photographer teams later.

### Phase 7 – Project Details Editing Entry Points (week 4-5)
- ⬜ Replace the standalone services section on the project details sheet with a summarized package block (name, totals, key deliverables) plus an “Edit package” action.
- ⬜ Launch the package wizard in edit mode from the project sheet, preloaded with the project’s current selections and overrides. Ensure save cancels gracefully and writes back to project records.
- ⬜ Surface change tracking (e.g., price deltas, removed services) so photographers understand impact before confirming updates.
- ⬜ Deliverables: photographers can review package context inside the project and re-run the wizard to make adjustments without duplicated UIs.
- ⬜ **MVP rule:** if the base package template changes later, keep project overrides as-is; future roadmap item is to offer a bulk sync flow listing affected projects.

## Dependencies & Reuse Checklist
- ✅ Reuse `AppSheetModal`, `NavigationGuardDialog`, `WizardStepper` patterns.
- ✅ Share service fetching logic via `useServices`.
- ✅ Adopt `Command` + `Combobox` components for type / method selection.
- ✅ Seed default delivery methods relevant to Turkish photographers (Online Gallery, USB Stick, Album, Printed Photos).
- ✅ Ensure new tables or columns (e.g., delivery methods) are defined with migrations before Phase 3.

## Decisions Recap
- ✅ **Ad-hoc services:** MVP supports adding custom (package-only) services inside the wizard. We will log interest in a future “Save to catalog” toggle but keep the first release simple.
- ✅ **Deposit toggle:** provide a control so photographers choose whether the percentage applies to the base price or the subtotal (base + services), defaulting to subtotal.
- ✅ **Delivery methods:** persist methods in the database so they follow the photographer across devices. Prefer reusing the session planning table; create a lightweight `package_delivery_methods` table if reuse is not practical.
- ✅ **Taxes (KDV):** out of scope for MVP.
- ✅ **Project overrides:** keep project changes scoped to the project for MVP; note a post-MVP roadmap item to offer optional sync-back or bulk update flows.

## Automated Coverage
- ✅ Snapshot helpers now cover hydration + update payload logic, ensuring pricing metadata (base vs client totals, deposit toggles) persists correctly.
- ✅ Reducer tests verify the new `HYDRATE_STATE` action resets dirty state and respects meta overrides when editing.

## Next Steps
- ✅ Decide how settings lists should display pricing (base vs client total) and align copy accordingly.
- ⬜ Smoke-test create & edit flows end-to-end in staging (existing packages without metadata, new ones with deposits, optional delivery).
- ⬜ Expand component-level tests (e.g., Pricing step mode switch, Summary step render) once UI polish is finalised.
- ⬜ Capture backlog ticket for future “sync updated package to projects” workflow including affected-projects preview.
