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
### Phase 0 – Plan & Alignment (now)
- ✅ Produce this plan, confirm MVP scope, gather answers to open questions.
- Outcome: clear list of requirements & decisions before writing code.

### Phase 1 – Skeleton & State (week 1)
- Create `features/package-creation/` folder with provider, reducer scaffolding, typed state slices (`basics`, `lineItems`, `delivery`, `pricing`, `meta`).
- Implement wizard shell using existing stepper + guard components, with placeholder step bodies.
- Hook sheet into Services/Packages settings entry point behind feature flag (hidden by default).
- Deliverables: navigation works (Next/Back), state resets, telemetry scaffolding ready.

### Phase 2 – Basics & Services (week 1-2)
- Build Basics step UI with validation, type multi-select (reuse combos from project wizard), visibility toggle.
- Implement Services & Inclusions step with service list (via `useServices`), quantity controls, running totals, and lightweight “quick add” custom item (state only).
- Compute totals in selectors, update step completion rules.
- Deliverables: user can configure basics + add line items; services step shows totals but doesn’t persist to Supabase yet.
- **Decision checkpoint:** requires confirmation on ad-hoc service behaviour (package-only vs save-to-catalog toggle).

### Phase 3 – Delivery & Pricing (week 2)
- Add Delivery step fields (photo count/range toggle, lead time value/unit, delivery method chips with inline add). Persist custom methods in state; migrations for stored list if required.
- Build Pricing step with base price input, auto services total (read-only), deposit selector (percent presets + custom percent/fixed). Confirm deposit calculation rule before coding.
- Deliverables: all wizard steps capture MVP data, computed summary state available.
- **Decision checkpoint:** delivery method persistence approach (reuse session table vs new field) + deposit calculation basis.

### Phase 4 – Summary & Submission (week 3)
- Compose Summary step with collapsible review cards, edit shortcuts, validation warnings.
- Implement submission pipeline: write package record, create line items, handle custom services (package-only for MVP), store delivery metadata.
- Add analytics events + success toast, closing behaviour.
- Deliverables: package creation end-to-end works in dev, error handling + loading states covered.
- **Decision checkpoint:** confirm no KDV/tax requirements before finalizing submission payload.

### Phase 5 – Polish & QA (week 3+)
- Localization (EN/TR), accessibility pass, responsive tweaks.
- Unit tests for reducer/actions, step validations; integration test covering happy path.
- Update docs, internal runbook, feature flag rollout plan.
- Deliverables: production-ready wizard ready for enablement once content validated.

## Dependencies & Reuse Checklist
- [ ] Reuse `AppSheetModal`, `NavigationGuardDialog`, `WizardStepper` patterns.
- [ ] Share service fetching logic via `useServices`.
- [ ] Adopt `Command` + `Combobox` components for type / method selection.
- [ ] Seed default delivery methods relevant to Turkish photographers (Online Gallery, USB Stick, Album, Printed Photos).
- [ ] Ensure new tables or columns (e.g., delivery methods) are defined with migrations before Phase 3.

## Decisions Recap
- **Ad-hoc services:** MVP supports adding custom (package-only) services inside the wizard. We will log interest in a future “Save to catalog” toggle but keep the first release simple.
- **Deposit toggle:** provide a control so photographers choose whether the percentage applies to the base price or the subtotal (base + services), defaulting to subtotal.
- **Delivery methods:** persist methods in the database so they follow the photographer across devices. Prefer reusing the session planning table; create a lightweight `package_delivery_methods` table if reuse is not practical.
- **Taxes (KDV):** out of scope for MVP.

## Next Steps
1. Kick off Phase 1: scaffold feature structure, reducer, and wizard shell with placeholder steps using the shared wizard components.
