# Package Creation Wizard Plan

## Goal
Introduce a guided, multi-step experience for configuring packages that matches the quality of the existing project creation and session planning wizards. The wizard should encourage complete data entry, surface live pricing totals, and support ad-hoc service additions without leaving the flow.

## MVP Focus & Audience
- **Primary user:** independent or small-studio Turkish photographers (weddings, engagements, corporate shoots) launching with minimal operational tooling.
- **Currency & language:** default to TRY pricing, copy localized in EN/TR; avoid multi-currency or tax widgets in MVP.
- **Complexity guardrails:** keep each step lightweight, avoid deep branching or advanced automations. Anything beyond core needs should be flagged as “post-MVP”.
- **Common inclusions we should support out of the box:** second shooter, drone, video add-on, retouching, printed album, digital gallery delivery, USB handover.

## Prior Art To Reuse
- **Wizard shell:** `ProjectCreationWizard` and `SessionPlanningWizard` already provide a responsive shell, progress tracking, and guard rails. We can lift the sheet wrapper, context pattern, and stepper layout.
- **State management:** Both wizards rely on reducers + context providers under `features/<wizard>/state`. We can mirror that shape for packages (`PackageCreationProvider`, reducer, selectors, action hooks).
- **Reusable UI elements:** `AppSheetModal`, segmented navigation, summary cards, alert guards, and shared form controls (`Input`, `Textarea`, `Switch`, `Command`, `Badge`, etc.) should be reused to keep UI consistent.
- **Data fetching utilities:** `useServices`, `useOrganization`, price formatters, and telemetry helpers already exist and should be leveraged.

## Step Breakdown

### 1. Basics
- **MVP fields:** package name, short description, applicable project/session types (multi-select), visibility toggle (active/inactive).
- **Deferred (post-MVP):** marketing tags, color coding, internal notes.
- **UX:** reuse `FormFieldCard` styling from project wizard details step; include validation states + inline hints. Keep form to a single column on mobile.
- **Data:** initial reducer slice `basics` with `name`, `description`, `applicableTypeIds`, `isActive`. `status`/tags stay bool/array ready for later.

### 2. Services & Inclusions
- **Service selection:** embed a searchable list of existing services (reuse service picker from `PackagesStep` in project wizard). Quantity control via `StepperInput` or plus/minus buttons.
- **Quick add custom (MVP):** minimal inline form (name + selling price, optional cost) to capture ad-hoc items without leaving the flow. Default vendor blank. Later we can add “Save to catalog” toggle.
- **Summary panel:** show running totals (cost, selling, margin) in TRY. Keep visuals simple (two stat chips) for MVP.
- **Out of scope for MVP:** tiered pricing per service, time-based scheduling, automatic tax calculations.
- **State:** slice `lineItems` with `type` (`existing`/`custom`), `serviceId`, `name`, `quantity`, `unitCost`, `unitPrice`.

### 3. Delivery
- **Fields:** estimated photo count (single number with optional range toggle), delivery lead time (numeric value + unit select of `days` or `weeks`), delivery methods (chip selector with seeded options: Online Gallery, USB, Album). Allow users to add a custom method inline; persistence to shared catalog can wait for post-MVP.
- **Components:** reuse `PillSelector`/`Badge` chips from session wizard for multi-select, `NumberInput` for counts.
- **State:** slice `delivery` { `estimateType`, `countMin`, `countMax`, `leadTimeValue`, `leadTimeUnit`, `methods`, `customMethodDraft` }.
- **Post-MVP:** courier tracking, staged deliveries, automatic reminders.

### 4. Pricing
- **Fields:** package base price (manual input), auto services total (read-only), calculated subtotal (base + services), deposit configuration.
- **Deposit controls:** segmented control for quick percentages (5, 10, 25, 50) plus toggle for custom percent or fixed TRY amount. Keep calculations simple (no tax). Percent should apply to subtotal (base + services) — confirm with Tayte before implementation.
- **State:** slice `pricing` { `basePrice`, `depositMode`, `depositValue` }. Services total computed via selector from `lineItems`.
- **Post-MVP:** currency conversion, payment schedule builder, discounts.

### 5. Summary
- **Review:** render collapsible summary cards mirroring project wizard summary step: basics info, delivery details, line item table, pricing breakdown, validation warnings.
- **Confirmation:** final CTA to create package, with "Edit" links jumping back to steps.
- **MVP display hints:** highlight total price in TRY, show deposit due, and list deliverables/services in plain language. Avoid printable PDFs or customer-facing exports for MVP.

## Data Flow & Persistence
- When submitting, create package record in `packages` table (fields: name, description, applicable types, visibility, delivery metadata, pricing).
- Bulk insert line items into `package_services` / new `package_line_items` table including quick-add entries (generate services if user opted to save to catalog).
- Store delivery methods in existing catalog table (mirroring session planning) with `organization_id`.
- Track analytics events per step using `trackEvent` (phase 2).

## Architecture Outline
1. `features/package-creation/`
   - `components/PackageCreationWizard.tsx` for the stepper UI.
   - `components/PackageCreationWizardSheet.tsx` handling modal lifecycle, guard dialog, submit.
   - `context/PackageCreationProvider.tsx` providing reducer + actions.
   - `state/packageCreationReducer.ts` defining slices for `basics`, `lineItems`, `delivery`, `pricing`, `meta`.
   - `steps/BasicsStep.tsx`, `ServicesStep.tsx`, `DeliveryStep.tsx`, `PricingStep.tsx`, `SummaryStep.tsx`.
   - `hooks/usePackageCreationActions.ts` etc.

2. Shared utilities for quantity handling, totals, and field validation.

3. Supabase interactions wrapped in `services/PackageCreationService.ts` to keep sheets lean.

## Implementation Phases
1. **Phase 0 (this doc):** finalize design + plan.
2. **Phase 1 – Skeleton & State:**
   - Scaffold feature directory, provider, reducer with typed state.
   - Implement wizard shell with stepper, navigation, guard, placeholder steps.
   - Hook into settings UI (open sheet).
3. **Phase 2 – Basics + Services Steps:**
   - Build actual form controls, service selection experience, totals computation.
   - Introduce custom service entry stored in state only.
4. **Phase 3 – Delivery + Pricing Steps:**
   - Implement delivery selectors, persistence models, deposit logic, computed totals.
   - Add shared catalog management for delivery methods.
5. **Phase 4 – Summary & Submission:**
   - Compose summary cards, submit handler creating package + line items.
   - Wire analytics, error handling, optimistic updates.
6. **Phase 5 – Polish & QA:**
   - Localization, tests (unit + integration), accessibility passes, docs update.

## Dependencies & Reuse Checklist
- [ ] Reuse `AppSheetModal`, `NavigationGuardDialog`, `WizardStepper` patterns.
- [ ] Share service fetching logic via `useServices`.
- [ ] Adopt `Command` + `Combobox` components for type / method selection.
- [ ] Seed default delivery methods relevant to Turkish photographers (Online Gallery, USB Stick, Album, Printed Photos).
- [ ] Ensure new tables or columns (e.g., delivery methods) are defined with migrations before Phase 3.

## Open Questions
- Should ad-hoc services become full services automatically, or remain package-only? **Proposal:** default to package-only for MVP but log interest in “Save to catalog” for later.
- Deposit: should the percent apply to subtotal (base + services) or base price only? Need confirmation before Phase 3.
- Delivery methods storage: reuse existing session planning table or introduce `package_delivery_methods`? For MVP we can keep methods in state and store serialized array on the package.
- Do we need Turkish tax/VAT handling (KDV) in MVP? Currently assumed **no**.

## Next Steps
1. Validate open questions with Tayte.
2. Kick off Phase 1 once requirements locked: scaffold feature structure + empty steps.
