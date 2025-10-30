# Project Creation Wizard — Implementation Plan

## Purpose
- Replace the legacy `EnhancedProjectDialog` flow with a step-based sheet that matches the new session planning experience.
- Consolidate all project creation entry points onto the same wizard while keeping duplication to a minimum.
- Ensure the solution is maintainable without attempting an over-general “one wizard to rule them all” abstraction.

## Goals & Constraints
- **Goals**
  - Deliver a four-step project creation wizard: lead selection/creation, project details (status/type/notes), package & services, summary/confirmation.
  - Match the session wizard sheet UI (layout, colors, progress indicator) so both flows feel visually unified.
  - Support lead-prefilled entry contexts (lead detail, board cards, dashboard quick actions) and ensure project creation can start from anywhere we launch it today.
  - Keep i18n coverage (EN + TR) and telemetry parity with the session flow.
- **Constraints**
  - No scheduling/date step for projects.
  - Avoid a mega-reducer that tries to juggle session + project fields simultaneously; prefer separate stores that share infrastructure pieces.
  - Reuse session wizard pieces via copy-or-wrapper patterns first (no deep shared abstractions until the project flow stabilises).
- Respect existing Supabase schemas; any new fields or mutations must be coordinated with backend before build.
- Minimise UI regressions by feature-flagging or staging rollout where possible.

## Status Update — 2025-10-30
- ProjectCreationWizard shell, provider, and sheet wrapper are live and power every project creation entry point via the compat wrapper.
- Lead selection panel now mirrors the session planner (no modal overlap issues) and the sidebar/step rail maintains full-height visuals regardless of right-pane content.
- Packages step ships the polished action pill: smooth scroll-on-select, selected-package chip, service chips with hover state, and guardrails for custom setup buttons.
- Summary copy aligns with the session wizard ("Review and confirm" + shared subtitle) and the dirty form guard uses the session-planner wording/buttons.
- Legacy sheet/modal components (`ProjectSheetView`, `ProjectDialog*`, `EnhancedProjectDialog`) are tagged as deprecated to steer new work toward the wizard.
- Core entry points (projects index, dashboard widgets, kanban board, session planner) now mount `ProjectCreationWizardSheet` directly; only legacy routes keep the compat wrapper.
- Toast copy across project + session wizards now relies on translated keys in EN/TR.
- Removed the legacy project creation dialog components; even legacy routes now open `ProjectCreationWizardSheet` directly.
- Remaining gaps: broaden automated coverage, run cross-entry QA, and remove legacy dialog artifacts once confidence is high.

## Current State Snapshot
- **Session Planning Wizard**
  - Lives under `src/features/session-planning/*`.
  - Provides a context + reducer, step components, API layer (`leadProjectCreation`, `sessionCreation`), and `SessionPlanningWizardSheet` wrapper that wires Supabase mutations, reminders, and telemetry.
  - Step list: lead → project → session type → location → schedule → notes → summary.
- **Legacy Project Creation**
  - Centralised in `src/components/EnhancedProjectDialog.tsx` with a large monolithic component handling lead search, inline lead creation, package/service selection, and Supabase mutations.
  - Referenced by: `src/pages/AllProjects.tsx`, `src/components/ProjectsSection.tsx`, `src/components/ProjectKanbanBoard.tsx`, and legacy views (`src/legacy/**/*`).
  - Lead detail and dashboard widgets open the same dialog through composed triggers.
  - Lacks the step-based UX, has limited progress feedback, and duplicates logic already modernised in the session planner.

## Proposed Approach
### 1. Clone the Session Wizard Shell for Projects
- Copy the existing `SessionPlanningWizard` shell into the project feature, keeping the sheet chrome, step navigation, and summary UI identical.
- Strip session-specific dependencies during the copy (schedule, notifications) and expose only the layout primitives needed by the project flow.
- Only extract micro-utilities (e.g. progress calculation helpers) if they have zero coupling; otherwise keep copies local to each wizard.

### 2. Introduce `ProjectCreation` Feature Module
- Create `src/features/project-creation/` with:
  - `ProjectCreationProvider` + reducer tailored to project-centric fields (lead, project details, packages/services, notes, summary).
  - Step components that reuse existing building blocks where sensible:
    - Lead step: wrap or lightly adapt the session planning lead picker so we inherit search + creation UX without duplicating UI.
    - Project details: pull base inputs from the current dialog (`ProjectTypeSelector`, status dropdown, description textarea).
    - Packages/services: reuse `ServicePicker` and package dropdown logic transplanted from `EnhancedProjectDialog`.
  - API helpers that reuse or extend `leadProjectCreation` for creating leads/projects and link to packages/services.
- Allow lead creation or selection inline, mirroring session flow behaviour.
- Provide validation rules per step and summary data for the shell.

### 3. Wizard Sheet Wrapper
- Build `ProjectCreationWizardSheet` mirroring `SessionPlanningWizardSheet` responsibilities:
  - Resolve entry context (prefill lead/project) using a lightweight resolver hook.
  - Handle Supabase mutations for creating the project, attaching packages/services, and firing onboarding milestones / notifications.
  - Emit telemetry events similar to session planning (`project_wizard_opened`, `project_wizard_completed`, etc.).
  - Expose callbacks (`onProjectCreated`) for host components to refresh data.

### 4. Entry Point Migration Strategy
- Replace `<EnhancedProjectDialog>` invocation with `<ProjectCreationWizardSheet>` in slices of the app:
  - `src/pages/AllProjects.tsx` (primary project list).
  - `src/components/ProjectsSection.tsx` (dashboard/home widgets).
  - `src/components/ProjectKanbanBoard.tsx`.
  - Lead-specific modals or details pages that currently show “Create project” buttons.
  - Legacy pages: either migrate or gate behind feature flag depending on product decision.
- Provide a compatibility layer (temporary wrapper component) so we can swap entry points incrementally.
- Remove `EnhancedProjectDialog` once all call sites migrate and QA passes.

## Implementation Phases
### Phase 0 — Discovery & Alignment
- Confirm final step list, field requirements, and validation rules with product/design.
- Inventory Supabase writes triggered by `EnhancedProjectDialog` (project insert, package/service relations, onboarding hooks) to ensure coverage in the new wizard.
- Decide feature flag or rollout strategy (e.g. `project_wizard_v2`).

### Phase 1 — Shell Copy & Visual Alignment
- [x] Duplicate the session wizard shell into the new project feature (`ProjectCreationWizard`), removing schedule/notification dependencies while preserving layout, colors, and step visuals.
- [x] Introduce minimal helper utilities (progress calculation, visited step tracking) scoped locally to avoid cross-wizard coupling.
- [x] Verify the copied shell renders identically by snapshotting against the session planner UI and adjusting classnames/tokens as needed. *(Visually aligned shell now lives under `project-creation/components/ProjectCreationWizard.tsx` with placeholder steps.)*

### Phase 2 — Project Creation State & Steps
- [x] Define reducer state shape and actions for project creation (lead, project core data, package/service selections, internal meta flags).
- [x] Wrap the session lead selector component (or extract a base variant) so both flows share UI while project-specific wiring lives in the new reducer.
- [x] Create fully functional step components:
  1. Lead (search or new).
  2. Project Details (name, type, status, description, optional notes).
  3. Packages & Services (existing `ServicePicker`, package dropdown, custom services editor).
  4. Summary (read-only overview, final validation, create button) mirroring session summary styling without scheduling notifications.
- [x] Ensure EN/TR copy is added to new `projectCreation` namespace and referenced through typed translation hooks. *(Stub strings landed in `src/i18n/resources/{en,tr}/projectCreation.json`.)*

### Phase 3 — Wizard Sheet Wrapper & API Wiring
- [x] Implement `ProjectCreationWizardSheet` orchestrating the provider, shell, and modal lifecycle, including Supabase mutations for projects, services, and base-price payments.
- [x] Integrate onboarding milestone completion parity with the previous dialog.
- [x] Record telemetry events (open, step view, completion, errors) consistent with analytics standards.
- [x] Add unit/integration tests covering reducer updates and start-step selection. *(New Jest suites ensure reducer merges preserve selections and the sheet respects entry context overrides.)*

### Phase 4 — Entry Point Migration
- [x] Introduce a thin compat wrapper (repurposed `EnhancedProjectDialog`) that renders the new wizard and honours existing props (`defaultLeadId`, `onProjectCreated`, etc.).
- [x] Swap entry points in:
  - `src/pages/AllProjects.tsx`.
  - `src/components/ProjectsSection.tsx`.
  - `src/components/ProjectKanbanBoard.tsx`.
  - Any lead/dashboard widgets discovered during discovery.
- [ ] Remove or archive the legacy dialog artifacts/tests once regression passes are complete.

### Phase 5 — QA, Rollout, and Cleanup
- Expand `docs/unit-testing-plan.md` with new coverage items.
- Run targeted regression tests (create project from each entry, with/without packages, creating new lead).
- Capture production parity metrics (time-to-create, adoption) once rolled out.
- Delete `EnhancedProjectDialog` and stale styles after rollout stabilises.

## Entry Point Audit Checklist
- `src/pages/AllProjects.tsx` — “Add project” CTA in header and empty states.
- `src/components/ProjectsSection.tsx` — Dashboard/home quick actions.
- `src/components/ProjectKanbanBoard.tsx` — Column add buttons.
- `src/pages/Payments.tsx` — Verify no hidden shortcuts spawn the old dialog.
- `src/legacy/**/*` — Determine whether to migrate or retire (document decision).
- Lead detail page (`src/pages/LeadDetail.tsx`) — confirm whether it relies on the dialog via shared components.

## Testing & Telemetry
- Extend existing testing pattern:
  - Reducer unit tests mirroring `SessionPlanningState` coverage.
  - Component tests for each wizard step (validation, default states, interactions).
  - Integration test similar to `SessionPlanningProvider.integration.test.tsx` validating the happy path payload.
- Telemetry events:
  - `project_wizard_opened`, `project_wizard_step_viewed`, `project_wizard_completed`, `project_wizard_error`.
  - Include metadata: entry source, lead/project IDs, package/service selections count.

## Risks & Mitigations
- **Risk:** Over-generalising the wizard shell complicates both flows.  
  **Mitigation:** Keep shell presentation-only, leave business logic in flow-specific providers.
- **Risk:** Supabase mutations diverge from legacy behaviour (missing onboarding triggers).  
  **Mitigation:** Snapshot current mutations from `EnhancedProjectDialog` and replicate via integration tests.
- **Risk:** Entry points missed during migration.  
  **Mitigation:** Use the audit checklist above and add runtime logging behind a temporary flag to confirm new sheet usage.

## Immediate Next Steps
1. Execute an end-to-end QA sweep across every entry point (projects index, dashboard widgets, kanban, lead detail) to validate the new sheet + guard behaviour.
2. Remove or archive the legacy project dialog components/tests once QA signs off and analytics confirm usage drop-off.
3. Monitor telemetry + error tracking during rollout (especially Supabase inserts and package/service attachment) and tighten coverage where gaps appear.
