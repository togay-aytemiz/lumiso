# Session Planning Revamp — Roadmap & Tracker

## Purpose & Audience
- Give Tayte (product owner) a single hub to track scope, decisions, and delivery checkpoints.
- Provide Codex (implementation agent) an execution playbook covering design, build, QA, and rollout.
- Keep the roadmap current as tasks finish; update status tables at the end of each working session.

## Vision
- A progressive, context-aware wizard replaces the current AppSheet form for planning sessions.
- Users land in the wizard from leads, projects, dashboard quick actions, or calendar slots, with relevant fields prefilled and skippable.
- Experience feels e-commerce-simple: focused steps, saved defaults, minimal typing, and flexibility to edit at any stage.
- Preserve existing entry buttons on lead, project, sessions index, and other launch points; each now opens the hardened wizard sheet.

## Guiding Principles
- Respect reusable component patterns; avoid bespoke wizard logic.
- No user-facing copy without EN & TR locale updates.
- Autosave to protect in-progress data and support cross-device continuity.
- Accessibility first: keyboard navigation, focus management, semantic headings, and ARIA where needed.
- Lean, observable, testable code: unit coverage for reducers/validators, component tests for steps, and analytics telemetry wired from day one.

## In-Scope
- New multi-step wizard UI with conditional steps and context banners.
- Lead/project selection or creation within the flow based on entry point.
- Session type selection with defaults and auto-generated session names (editable).
- Location handling with address book, last-used defaults, and online meeting URLs.
- Schedule selection with timezone awareness, calendar prefills, and quick actions.
- Optional notes, summary review, and notification workflow preview with opt-out controls.
- CRUD APIs and persistence for sessions, addresses, and notification preferences.
- Analytics, logging, and rollout plan for a staged release behind feature flags.

## Out-Of-Scope (Phase 1)
- Third-party address verification or mapping integrations (captured in parking lot).
- Complex notification customization (editing templates or schedule rules inside the wizard).
- Offline mode or mobile-specific layouts beyond responsive design.
- External calendar sync (Google, Outlook) beyond manual export actions.

## Entry Points & Prefill Behavior
| Entry Source | Prefilled Fields | Step Adjustments |
| --- | --- | --- |
| Lead detail page | `lead` | Skip lead step, show edit link; project step prompts to select or create. |
| Project detail page | `lead`, `project` | Skip lead and project by default; edit links exposed in summary and breadcrumb. |
| Dashboard quick action | None | Start at lead selection; project optional. |
| Dashboard calendar cell | `date`, optionally `startTime` | Same as dashboard, but schedule step prefilled; indicator shows origin. |
| Future shareable link | Depends on payload | Use same context resolver; ensure access permissions validated. |

## Wizard Flow Overview
1. **Lead** — search, filter, or create inline with validation; context banner appears when prefilled.
2. **Project** — select existing (sorted by recency), create inline, or skip when not required.
3. **Session Type** — list system-defined types, mark recommended default, include description tooltip.
4. **Session Details** — auto-name from session type; provide optional edit toggle for custom names.
5. **Location** — address book picker with inline create/edit; supports physical addresses and meeting URLs.
6. **Schedule** — date/time pickers with timezone awareness, quick buttons (+30m, +1h), conflict warnings.
7. **Notes** — optional markdown-limited field; integrate with CRM notes when enabled.
8. **Summary** — review of selections, edit shortcuts, notification workflow preview, confirmation action.

Skipped steps remain accessible from breadcrumbs; analytics record auto-skips for insight.

## Lo-Fi Prototype Plan
- Deliver a true low-fidelity prototype (clickable Figma frame or coded Storybook sandbox) before high-fidelity design begins.
- Start with the `/sessions` entry point: reuse existing “Schedule Session” button and launch a bare-bones overlay that stacks the steps vertically with neutral styling.
- Provide alternate entry views (lead, project, calendar) as variant tabs within the prototype so we can validate prefill behavior early.
- Capture usability feedback on layout, step transitions, and opt-out toggles using the lo-fi prototype before investing in polished visuals.
- Once hi-fi designs are signed off, port the refined wizard shell into other surfaces by pointing existing entry actions at the shared component.

## Decisions Log
| Topic | Decision | Rationale | Owner | Date |
| --- | --- | --- | --- | --- |
| Address verification | Launch with trusted user input; track bounce/invalid rates and revisit vendor integration post-V1. | Keeps scope lean while leaving room for future enrichment. | Codex | 2025-02-14 |
| Session naming | Default to session type label, keep field editable before confirmation. | Supports custom naming conventions without extra step. | Tayte | 2025-02-14 |
| Notification overrides | Use workflow settings as defaults; allow per-session opt-out toggle before confirmation. | Preserves automation while giving one-off control. | Tayte | 2025-02-14 |
| Wizard localization | Store wizard copy in dedicated EN/TR `sessionPlanning` namespace and block merges without both translations. | Guarantees copy parity and keeps localization maintainable. | Codex | 2025-02-17 |

## UX & Interaction Notes
- Breadcrumb + progress indicator reflect only steps the user touches; skipped steps appear dimmed.
- Context banners explain prefilled data (“Loaded from Project ‘Autumn Wedding’”).
- “Show more options” accordions hide advanced fields (e.g., custom session name).
- Location selector acts like an address book: default card, recents, and “Add new” inline form.
- Notification preview card lists each outgoing message (e.g., “Client confirmation — immediately”, “Client reminder — 24h before”). Opt-out toggles remove selected workflows from the create payload.
- Autosave drafts after each step; surface “Draft saved” toast with timestamp.
- Provide success toast + link to session detail upon confirmation. Optionally offer “Plan another session”.

## Data & API Considerations
### Session Entity Additions
- `sessionTypeId`, `customName`, `locationId`, `locationLabel`, `locationMeta` (JSON), `preferredMeetingUrl`.
- `notificationOverrides` array storing suppressed workflow IDs.
- `wizardContext` snapshot for analytics/debugging.

### SessionAddress Model (`session_addresses`)
- `id`, `ownerUserId`, `label`, `line1`, `line2`, `city`, `state`, `postalCode`, `countryCode`, `meetingUrl`, `isOnline`, `lat`, `lng`, `lastUsedAt`, timestamps, soft delete flag.
- API endpoints: list (paginated), create, update, soft delete. Permissions scoped to organization.

### Supporting Services
- Context resolver: deduces entry point, fetches required lead/project data, and pre-populates wizard store.
- Notification service: extends existing workflow engine to respect per-session opt-outs.
- Audit logging: record wizard actions for compliance (create, edit, cancel).

## Technical Implementation Roadmap
### Phase 0 — Discovery & Design
- [ ] Validate flow with design, produce mid-fi wireframes and interaction specs.
- [ ] Confirm API contract updates with backend lead (session, addresses, notifications).
- [ ] Define analytics event schema and naming conventions.

### Phase 1 — Infrastructure & Shared Utilities
- [ ] Build wizard state manager (React context + reducer) with autosave persistence.
- [ ] Create step shell components (header, actions, progress indicator, breadcrumb).
- [ ] Implement context resolver hooking into existing routing (lead/project/dashboard/calendar).
- [ ] Extend i18n bundles (EN/TR) with core wizard copy placeholders.

### Phase 2 — Core Steps
- [ ] Lead selection/creation step with search + inline create modal.
- [ ] Project selection/creation step with optional skip and validation.
- [ ] Session type selector with default, description tooltip, and accessibility focus handling.
- [ ] Session details step enabling optional custom name.

### Phase 3 — Location & Schedule
- [ ] Address book component with list, quick add, and last-used default.
- [ ] Inline address form with validation (postal code formatting, URL scheme detection).
- [ ] Schedule picker with timezone handling, conflict detection, and quick actions.
- [ ] Notes step with markdown sanitization.

### Phase 4 — Summary & Confirmation
- [ ] Summary review card with edit links.
- [ ] Notification preview widget + opt-out toggles integrated with workflow service.
- [ ] Final confirmation mutation wiring + success state.
- [ ] Draft cleanup and telemetry instrumentation.

### Phase 5 — Hardening & Rollout
- [ ] Automated tests (unit, component, integration) per Testing Strategy section.
- [ ] Performance & accessibility audits (axe, keyboard walkthrough, responsive checks).
- [ ] Feature flag rollout (internal → beta → GA) with monitoring dashboards.
- [ ] Documentation updates (help center EN/TR, internal runbooks).

## Testing Strategy
- Unit: reducers, validation helpers, autosave persistence, notification override serializer.
- Component: each wizard step (prefill vs. manual), summary review, address book interactions.
- Integration/E2E: end-to-end flow via lead, project, dashboard, calendar entry points; cover opt-out path.
- Regression: ensure legacy session creation APIs remain stable until deprecation.
- Accessibility: automated axe suite + manual keyboard/screen-reader checks.
- Localization: validate EN/TR rendering for every wizard string via the `sessionPlanning` namespace (snapshot or Storybook toggle).
- Observability: verify analytics events fire with correct payloads; monitor error logs post-launch.

## Analytics & Observability
- Core metrics: wizard completion rate, average steps visited, auto-skip frequency, opt-out usage, draft abandonment.
- Error tracking: instrument step-level validation failures and API errors with Sentry tags.
- Dashboards: add Looker/Metabase tiles for weekly adoption and notification opt-out trends.

## Security & Privacy
- Enforce permission checks for creating leads/projects/sessions.
- Sanitize all user input (notes, addresses) before storage or display.
- Store meeting URLs securely; flag if non-https.
- Ensure notification opt-outs respect GDPR/communication preferences.

## Rollout Plan
1. Release behind feature flag to internal team; collect feedback.
2. Expand to pilot group; monitor analytics and support tickets.
3. Enable for all orgs; keep legacy form accessible via fallback toggle for two weeks.
4. Remove legacy implementation after adoption target (>90% usage) met.

## Parking Lot / Future Enhancements
- Evaluate address verification provider (e.g., Loqate, Google Places) based on invalid address rate.
- Add calendar sync (Google/Outlook) with attendees.
- Support batch session creation for multi-day events.
- Introduce template-based notes or checklists per session type.

## Risks & Mitigations
- **Risk:** Prefill context fails and confuses users. **Mitigation:** Show explicit fallback states and log context errors.
- **Risk:** Autosave conflicts (multi-tab). **Mitigation:** Version drafts, warn on newer draft existence, throttle saves.
- **Risk:** Notification opt-out accidentally disables required reminders. **Mitigation:** Prominent confirmation copy and audit trail.
- **Risk:** Scope creep from future enhancements. **Mitigation:** Stick to phase boundaries; track extras in parking lot.

## Timeline Targets (TBC)
| Milestone | Target Date | Owner | Status |
| --- | --- | --- | --- |
| Discovery sign-off | 2025-02-21 | Tayte & Codex | TODO |
| API schema finalized | 2025-02-28 | Backend Lead | TODO |
| Wizard MVP behind flag | 2025-03-21 | Codex | TODO |
| Pilot rollout complete | 2025-04-04 | Product | TODO |
| GA launch | 2025-04-18 | Product/Engineering | TODO |

## Working Agreements
- Update this file after each significant change with status checkboxes or notes.
- End each coding task affecting the repo with a single-line commit summary message.
- Keep communication async-friendly: document assumptions, link to tickets, and capture unanswered questions here.

## References
- `docs/session-types-plan.md` — existing system session types overview.
- `docs/unit-testing-plan.md` — testing standards and coverage tracker.
- `.codex/rules.md` — coding and process guidelines to follow during implementation.
