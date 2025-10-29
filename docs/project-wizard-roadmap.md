# Project Creation Wizard Roadmap

## Phase 1 · Discovery & Inventory
- [ ] Document the current session planning architecture (context provider, reducer, hooks, `SessionPlanningWizard` shell, step components, shared utilities).
- [ ] Tag components already step-agnostic (progress header, summary cards, sheet layout, validation helpers) for direct reuse.
- [ ] Audit all async dependencies used by session planning (lead lookup, project search, session type fetch, schedule validation) and note which can be generalized.
- [ ] Catalogue project creation surfaces (`EnhancedProjectDialog`, `ProjectSheetView`, service/package pickers, lead selector) and capture their data requirements, side-effects, and API calls.

## Phase 2 · Shared Framework Design
- [ ] Define a generic wizard context/state contract that supports pluggable step sequences (lead, project, schedule, etc.).
- [ ] Draft a step registration model (ID, label, summary selector, validation rule, component factory) that both session and project flows can populate.
- [ ] Plan shared asynchronous loaders (leads, packages, project types, services, session types) with caching/dedupe strategy.
- [ ] Outline UX primitives to reuse (sheet chrome, progress indicator, summary sidebar, mobile accordion behavior) and any styling adjustments needed for project workflows.

## Phase 3 · Session Planning Migration
- [ ] Refactor `SessionPlanningWizard` to consume the shared wizard shell without changing user-facing behavior.
- [ ] Update existing session planning steps to the new step contract; adapt reducer/actions as needed.
- [ ] Backfill unit/integration tests to cover the refactored flow (step transitions, validation, summary rendering).
- [ ] Smoke test create/edit flows to ensure telemetry, toasts, and autosave behaviors remain intact.

## Phase 4 · Project Creation Adoption
- [ ] Implement `ProjectCreationWizard` using the shared framework with a tailored step list (lead selection/new lead, project details, services/packages, schedule/notes, summary).
- [ ] Replace `EnhancedProjectDialog` entry points with the new wizard, keeping sheet triggers and navigation guards.
- [ ] Migrate supporting pickers (project type, package, service) into reusable step modules or shared components as appropriate.
- [ ] Ensure onboarding milestones, notifications, and Supabase mutations fire correctly in the new flow.

## Phase 5 · Validation & Rollout
- [ ] Expand test coverage (unit + integration) for both wizards, including async loaders, error states, and summary content.
- [ ] Update `docs/unit-testing-plan.md` and any onboarding/runbooks to reflect the new shared wizard architecture.
- [ ] Coordinate feature flag or staged rollout if needed, with monitoring checkpoints post-release.
- [ ] Archive or remove legacy project creation components once migration is stable.
