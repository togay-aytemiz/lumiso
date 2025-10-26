# Session Planning Wizard — Implementation Outline

## Objectives
- Deliver the progressive, context-aware session planning wizard described in `docs/session-planning-roadmap.md`.
- Ship a lo-fi prototype first (Storybook or lightweight page) to validate flow, context resolution, and copy scaffolding before high-fidelity polish.
- Preserve current entry surfaces (lead, project, dashboard actions) while swapping the underlying UI for the new wizard.

## High-Level Architecture
- Feature module: create `src/features/session-planning/` with colocated components, hooks, reducers, tests, and translations.
- Shell component `SessionPlanningWizard` orchestrates step routing, navigation controls, autosave banner, and analytics events.
- Step components live under `features/session-planning/steps/` (one per stage) and receive state/dispatch via context.
- Shared context/reducer manages wizard state (`lead`, `project`, `sessionType`, `details`, `location`, `schedule`, `notes`, `notifications`, `meta`).
- Entry-point resolver hook (`useSessionPlanningEntryContext`) ingests payload (lead/project ids, schedule hints) and primes initial wizard state.
- Autosave service persists drafts to Supabase (per user/lead/project) with versioning/last-updated metadata.
- Wizard host renders inside `AppSheetModal` replacement shell sized responsively; same component can mount in sheets or full-page layouts.

## State Management
- `useReducer` + action creators typed with discriminated unions for predictability and unit test coverage.
- Derived selectors (e.g., `selectIsStepComplete`, `selectDraftDirtyFields`) exported for component use & tests.
- Autosave side-effect hook triggers on debounced dirty state using `useEffect`, ensures conflict detection via `updatedAt` timestamp.
- Validation composed per step: synchronous functions returning error maps; async validation (e.g., conflict detection) handled via explicit `validateStep` action.

## Step Breakdown
1. **LeadStep** — search/select existing lead, or inline create (scoped to lo-fi: existing search only, stub create button).
2. **ProjectStep** — choose existing or create; handle optional paths when lead-only flow allowed.
3. **SessionTypeStep** — fetch system session types, display recommended default, update session name seed.
4. **DetailsStep** — name auto-generation override, optional description editing, tags.
5. **LocationStep** — address book picker + manual entry, meeting URL validation.
6. **ScheduleStep** — timezone-aware date/time pickers, quick offsets, conflict warnings (lo-fi stubbed).
7. **NotesStep** — markdown-limited textarea, character count, CRM feed preview (lo-fi optional).
8. **SummaryStep** — review card with edit shortcuts, notification preview, final confirm CTA.

## Data & API Integration
- CRUD service module `features/session-planning/api.ts` that wraps Supabase RPCs/table calls.
- Leverage existing `useSessionForm` logic where possible by extracting shared `createSession` service.
- Introduce typed DTOs for leads/projects/sessions to keep wizard code platform-agnostic.
- Notification preview uses existing workflow triggers for planned sessions; ensure opt-out toggles map to stored preferences.

## Autosave & Draft Handling
- `session_planning_drafts` table (to be added) storing serialized wizard state, version, user, organization, and context keys.
- Draft retrieval based on entry payload; prompt user when a newer draft exists.
- Conflict resolution: allow overwrite, duplicate-as-new, or discard options (phase 1: prompt to keep latest or discard).
- Debounce autosave (e.g., 1.5s) and throttle to avoid excessive Supabase writes.

## Analytics & Telemetry
- Fire `session_wizard_step_viewed`, `session_wizard_step_completed`, `session_wizard_auto_skip`, `session_wizard_confirmed`, `session_wizard_abandoned`.
- Attach properties: step id, entry source, lead/project ids, prefill success, time spent per step.
- Wire analytics provider via shared `trackEvent` helper; ensure silent failure handling.

## Accessibility & UX Guardrails
- Use focus management to move focus to the primary heading on step change.
- Keyboard navigation support: arrow/tab for stepper, ESC for close (respect dirty guard).
- Provide aria-live region for autosave status messages.
- All actionable elements meet contrast requirements in default theme.

## Localization
- Centralize wizard copy in a dedicated `sessionPlanning` namespace with EN/TR parity; block merges missing either locale.
- Step components rely on `useTranslation("sessionPlanning")`, so any new UI strings must land in both `en/sessionPlanning.json` and `tr/sessionPlanning.json`.
- Extending to additional locales is a matter of adding the locale resource file and wiring it through `i18n/index.ts`.

## Testing Strategy (per roadmap)
- Unit tests for reducer actions, selectors, and validation modules.
- Component tests for step components covering prefill, manual entry, and validation errors.
- Integration tests simulating entry contexts (lead, project, dashboard) ensure navigation & autosave behave.
- Accessibility snapshot tests with axe in Storybook or Vitest environment.
- Localization regression checks comparing EN/TR renders (Storybook locale toggle or screenshot diff).

## Migration Plan
- Guard new wizard behind feature flag (`session_wizard_v1`).
- Replace `SessionSchedulingSheet` contents with wizard host while keeping original API as fallback (controlled by flag).
- Provide shared interface for legacy form toggling until GA target met.

## Open Questions / Follow-Ups
- Confirm data model updates (draft table, notification preference schema).
- Clarify requirements for calendar conflict detection (needs backend support?).
- Determine minimal viable notification preview scope for pilot.
- Define telemetry payloads for the new lead/project sheet launches (so we can measure adoption).

- [ ] Add Storybook (or temporary route) harness to demo the lo-fi wizard with mocked data.

## Current Focus
- Autosave/draft conflict handling and telemetry instrumentation.
- Lead/project context resolver sharing across entry points.

### Recently Landed (Feb 17)
- ✅ Lead picker wired to shared lead creation sheet + searchable command UI.
- ✅ Project picker reuses project creation sheet with lead prefill and search.
- ✅ Drawer summary + bottom-sticky actions replaced the dual-column layout.

## Design & UI Follow-Up
- Transition the wizard shell and steps from lo-fi placeholders to production-ready UI adhering to Lumiso design system tokens. *(Initial pass shipped: dual-column layout with persistent summary sidebar and updated step cards.)*
- Partner with design to lock hi-fi mocks (states, breakpoints, motion) before final styling pass.
- Introduce reusable UI primitives (step cards, summary tiles, address book list) so future teams can compose consistent flows.
