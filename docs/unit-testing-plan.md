# Unit Testing Strategy & Tracker

## Purpose & Audience
- Give Tayte a living roadmap for where unit tests deliver the biggest safety wins.
- Provide Codex (and future contributors) a checklist to follow whenever we touch the test suite.
- Keep progress transparent with a single place to log what landed, what is next, and why.

## TL;DR: Unit Tests Explained Like You’re 15
- A unit test is a tiny robot teammate that checks one move in our app (a function, hook, or component).
- We run all the robots after every code change; if one screams, we know exactly what broke.
- Writing them costs some time now but saves way more time hunting bugs later.

## Guiding Principles (Codex Snapshot)
- Ship production-quality solutions with automated tests where feasible; document any manual verification.
- Respect i18n: never hardcode user-facing copy without updating EN and TR locales.
- No one-off hacks—favor clean abstractions, reusable components, and DRY patterns.
- Capture follow-up steps (tests, docs, rollout) in the plan before closing a task.
- Finish repo-altering work with a single-line commit summary.

## Testing Infrastructure To-Dos
- [x] Add `"test": "jest"` (or equivalent) to `package.json` scripts so running tests is one command.
- [x] Wire `setupTests.ts` into Jest (`setupFilesAfterEnv`) and ensure `tsconfig` includes test files.
- [x] Configure CI to run `npm run test` on pull requests (reuse existing workflow if available).
- [ ] Document how to use `src/utils/testUtils.tsx` for provider-wrapped renders.
- [ ] Decide on the folder convention (`*.test.ts` beside file vs. `__tests__` directories) and stick to it.
- [x] Configure Deno-based test runner for `supabase/functions/**` (`deno test --allow-env --allow-net` with local mocks).

### Test Harness Decisions
- Use **Jest 30 (Node + jsdom environment)** for everything under `src/**`, pairing it with Testing Library and our custom provider wrapper. Keep tests colocated with the code they cover.
- Use **Deno’s built-in test runner** for Supabase edge functions under `supabase/functions/**`. Author deterministic tests that stub the Supabase admin client and external services (Resend, fetch) via dependency injection or mock factories.
- When in doubt about where logic lives, prefer moving business rules into plain TypeScript modules so they are testable with Jest, leaving Deno functions as thin orchestrators.
- Commands: `npm test` for Jest, `npm run test:deno` (alias for `deno task test`) for Supabase functions. Ensure Deno 1.x is installed locally (e.g., `brew install deno` or via `deno.land` installer).

## Test Target Inventory

### Progress Snapshot _(update after each iteration)_
| Category | Done | Total | Completion |
| --- | --- | --- | --- |
| Core Libraries & Helpers | 13 | 13 | 100% |
| Services & Data Access | 5 | 5 | 100% |
| Contexts & Hooks | 24 | 24 | 100% |
| UI Components & Pages | 13 | 27 | 48% |
| UI Primitives & Shared Components | 1 | 8 | 13% |
| Supabase Edge Functions & Automation | 0 | 9 | 0% |
| **Overall** | **56** | **86** | **65%** |

### Core Libraries & Helpers
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Locale/date formatting helpers | `src/lib/utils.ts` | Locale-aware formatting, 24h/12h detection, week range math | High | Done | Covered by `src/lib/utils.test.ts` (EN vs TR paths + week math). |
| Organization ID caching | `src/lib/organizationUtils.ts` | Cache hit/miss, Supabase auth fallback, error resilience | High | Done | Covered via `src/lib/organizationUtils.test.ts` with cache + creation paths. |
| Organization settings cache | `src/lib/organizationSettingsCache.ts` | Memory vs localStorage sync, TTL expiry, inflight dedupe | Medium | Done | Covered via `src/lib/__tests__/organizationSettingsCache.test.ts`. |
| Org-aware date/time utils | `src/lib/dateFormatUtils.ts` | Timezone conversions, format fallbacks, supported list ordering | High | Done | Covered by `src/lib/dateFormatUtils.test.ts` with timezone conversions + fallback scenarios. |
| Dynamic lead validation | `src/lib/leadFieldValidation.ts` | Schema generation per field type, sanitize/parse helpers | High | Done | Covered by `src/lib/leadFieldValidation.test.ts` across required rules, coercion, and helper flows. |
| Session lifecycle sorting | `src/lib/sessionSorting.ts` | Lifecycle grouping, legacy status mapping, timestamp ordering | Medium | Done | Covered by `src/lib/sessionSorting.test.ts` (modern + legacy lifecycle ordering). |
| Validation utilities | `src/lib/validation.ts` | Email/password schemas, sanitizer fallbacks | Medium | Done | Covered by `src/lib/validation.test.ts` (schema guards + DOMPurify fallback). |
| Template utilities | `src/lib/templateUtils.ts` | Placeholder fallbacks, spam word detection, block/plain conversions | Low | Done | Covered by `src/lib/templateUtils.test.ts` (fallback placeholders + block/plain conversion). |
| Session naming helpers | `src/lib/sessionUtils.ts` | Priority ordering (custom name, project type, lead), fallback behavior | Low | Done | Covered by `src/lib/sessionUtils.test.ts` (name trimming + project/lead fallbacks). |
| Relative date helpers | `src/lib/dateUtils.ts` | Today/tomorrow/yesterday detection, overdue sessions flags | Medium | Done | Covered by `src/lib/dateUtils.test.ts` using mocked system date + i18n fallbacks. |
| Input normalization utilities | `src/lib/inputUtils.ts` | Trimming handlers, blur normalization, event typing | Low | Done | Covered by `src/lib/inputUtils.test.ts` (change + blur handlers normalize spacing). |
| Payment color mapping | `src/lib/paymentColors.ts` | Consistent status color lookups, fallback color selection | Low | Done | Covered by `src/lib/paymentColors.test.ts` for palette integrity + class conventions. |
| Project summary builder | `src/lib/projects/buildProjectSummaryItems.tsx` | Aggregate KPI rows, empty state handling | Medium | Done | Covered by `src/lib/projects/buildProjectSummaryItems.test.tsx` with zero-data + rich summary cases. |

### Services & Data Access
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Project data service | `src/services/ProjectService.ts` | Aggregated fetches, archived filtering, payment totals | High | Done | Covered via `src/services/__tests__/ProjectService.test.ts` (aggregation + filtering). |
| Session data service | `src/services/SessionService.ts` | Filtering, archived project exclusion, lead enrichment | High | Done | Covered via `src/services/__tests__/SessionService.test.ts` (archived filter + sort/filter logic). |
| Lead data service | `src/services/LeadService.ts` | Search/filter combinations, pagination guards, Supabase fallbacks | High | Done | Covered via `src/services/__tests__/LeadService.test.ts` (custom field merge + filter/sort). |
| Lead detail aggregator | `src/services/LeadDetailService.ts` | Parallel fetch composition, null safety when relations missing | Medium | Done | Covered via `src/services/__tests__/LeadDetailService.test.ts` for archived filtering, payment math, and activity fallbacks. |
| Base entity service foundation | `src/services/BaseEntityService.ts` | Shared `getOrganizationId`, error handling, caching | Medium | Done | Covered by `src/services/__tests__/BaseEntityService.test.ts` for org lookup failure handling and authenticated user guard. |

### Contexts & Hooks
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Organization settings hook | `src/hooks/useOrganizationSettings.ts` | React Query caching, update path success/error toasts | High | Done | Covered by `src/hooks/__tests__/useOrganizationSettings.test.tsx` (cache + update/upsert + error toast). |
| Session form workflow | `src/hooks/useSessionForm.ts` | Validation guardrails, Supabase insert payload, workflow trigger recovery | High | Done | Covered by `src/hooks/__tests__/useSessionForm.test.tsx` validating validation, success path, trigger failure, auth error. |
| Session reminder scheduling | `src/hooks/useSessionReminderScheduling.ts` | RPC invoke, graceful error handling, reschedule flow | Medium | Done | Covered via `src/hooks/__tests__/useSessionReminderScheduling.test.tsx` (RPC fail warns, cancel/reschedule). |
| Workflow trigger wrapper | `src/hooks/useWorkflowTriggers.ts` | Input validation (UUID), invoke payload, toast on failure | Medium | Done | Covered by `src/hooks/__tests__/useWorkflowTriggers.test.ts` for validation, toast guard, and payload shaping. |
| Lead status actions | `src/hooks/useLeadStatusActions.tsx` | Auth guard, optimistic flags, destructive toast action | Medium | Done | Covered by `src/hooks/__tests__/useLeadStatusActions.test.tsx` for auth guard, undo toast action, and error handling. |
| Session actions | `src/hooks/useSessionActions.ts` | Reminder cleanup, workflow triggers on status change | High | Done | Covered via `src/hooks/__tests__/useSessionActions.test.tsx` for delete failure + status update flows. |
| Entity data helper | `src/hooks/useEntityData.ts` | Error propagation, dependency refresh behavior | Medium | Done | Covered by `src/hooks/__tests__/useEntityData.test.tsx` for toast fallback, dependency refetch, and custom error handlers. |
| User preferences hook | `src/hooks/useUserPreferences.ts` | Default bootstrap, optimistic updates, retry strategy | High | Done | Covered by `src/hooks/__tests__/useUserPreferences.test.ts` for bootstrap, defaults, optimistic + helper flows. |
| Auth provider | `src/contexts/AuthContext.tsx` | Role fetching, auth change handling, sign-out side effects | High | Done | Covered by `src/contexts/__tests__/AuthContext.test.tsx` (session bootstrap + role fetch + sign-out). |
| Organization provider | `src/contexts/OrganizationContext.tsx` | Initial load, presence heartbeat cleanup, data prefetch | High | Done | Covered by `src/contexts/__tests__/OrganizationContext.test.tsx` (bootstrap fetch + refresh toast trigger). |
| Onboarding provider | `src/contexts/OnboardingContext.tsx` | Computed flags, guarded transitions, batch completion | Medium | Done | Covered by `src/contexts/__tests__/OnboardingContext.test.tsx` (computed flags + action guardrails). |
| Calendar performance monitor | `src/hooks/useCalendarPerformanceMonitor.ts` | Throttle thresholds, cleanup handlers | Low | Done | Covered by `src/hooks/__tests__/useCalendarPerformanceMonitor.test.ts` for timing metrics, memory usage, and dev warnings. |
| Organization data query helper | `src/hooks/useOrganizationData.ts` | Active org guards, queryKey composition, Supabase ensures | High | Done | Covered by `src/hooks/__tests__/useOrganizationData.test.ts` for guard rails, RPC ensure_default calls, and placeholder handling. |
| Lead detail data aggregator | `src/hooks/useLeadDetailData.ts` | Session metrics, combined queries, refetch fan-out | High | Done | Covered by `src/hooks/__tests__/useLeadDetailData.test.tsx` for metrics, refetch fan-out, and default fallbacks. |
| Session edit form | `src/hooks/useSessionEditForm.ts` | Dirty tracking, Zod validation, reschedule workflow path | High | Done | Covered by `src/hooks/__tests__/useSessionEditForm.test.tsx` for validation errors, workflow triggers, reminders, and Supabase errors. |
| Reminder actions | `src/hooks/useReminderActions.ts` | Delete/update mutations, toast feedback, error handling | Medium | Done | Covered via `src/hooks/__tests__/useReminderActions.test.ts` for success + error toasts and null handling. |
| Project payments hook | `src/hooks/useProjectPayments.ts` | Aggregated totals, missing services/payments fallback | Medium | Done | Covered by `src/hooks/__tests__/useProjectPayments.test.tsx` aggregating totals, handling errors, and verifying refresh/refetch. |
| Project sessions summary hook | `src/hooks/useProjectSessionsSummary.ts` | Status grouping, overdue detection, refresh triggers | Medium | Done | Covered by `src/hooks/__tests__/useProjectSessionsSummary.test.tsx` (status grouping + refresh triggers). |
| Organization quick settings | `src/hooks/useOrganizationQuickSettings.ts` | Memo defaults, refresh passthrough | Low | Done | Covered via `src/hooks/__tests__/useOrganizationQuickSettings.test.tsx` ensuring default true and refetch passthrough. |
| Organization timezone | `src/hooks/useOrganizationTimezone.ts` | Format conversion helpers, detect fallback timezone | Medium | Done | Covered via `src/hooks/__tests__/useOrganizationTimezone.test.ts` ensuring settings-driven formats and fallback timezone detection. |
| Notification triggers | `src/hooks/useNotificationTriggers.ts` | Milestone notifications, batch scheduling, toast errors | Medium | Done | Covered by `src/hooks/__tests__/useNotificationTriggers.test.ts` for Supabase insert/invoke flows and error toasts. |
| Settings section manager | `src/hooks/useSettingsSection.ts` | Auto-save throttling, dirty tracking, toast toggles | Medium | Done | Covered via `src/hooks/__tests__/useSettingsSection.test.ts` for manual saves, auto-save throttle, and toast/error handling. |
| Template builder hook | `src/hooks/useTemplateBuilder.ts` | Load/save pipelines, placeholder extraction, publish flow | High | Done | Covered by `src/hooks/__tests__/useTemplateBuilder.test.tsx` for load transforms, block conversions, and publish toast. |
| Template validation hook | `src/hooks/useTemplateValidation.ts` | Warning/error matrix, published template requirements | Medium | Done | Covered by `src/hooks/__tests__/useTemplateValidation.test.ts` for missing template, name/content validation, placeholders, and published requirements. |

### UI Components & Pages
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Enhanced lead creation | `src/components/EnhancedAddLeadDialog.tsx` | Dynamic schema init, default status lookup, save pipeline | High | Done | Covered by `src/components/__tests__/EnhancedAddLeadDialog.test.tsx` verifying default status creation, value persistence, and navigation guard. |
| Enhanced lead edit | `src/components/EnhancedEditLeadDialog.tsx` | Prefill logic, change detection, update mutation flow | High | Done | Covered by `src/components/__tests__/EnhancedEditLeadDialog.test.tsx` for prefill, validation, and Supabase updates. |
| Enhanced project dialog | `src/components/EnhancedProjectDialog.tsx` | Cross-entity linking, lead selection, Supabase upserts | High | Done | Covered by `src/components/__tests__/EnhancedProjectDialog.test.tsx` ensuring data fetch, custom setup, and close/reopen resets. |
| Session scheduling dialog | `src/components/ScheduleSessionDialog.tsx` | Prefill data, reminder scheduling hooks, status updates | High | Done | Covered via `src/components/__tests__/ScheduleSessionDialog.test.tsx` & `SessionSchedulingSheet.test.tsx`. |
| Session scheduling sheet | `src/components/SessionSchedulingSheet.tsx` | Mobile sheet state, timezone-aware slots, submission flow | Medium | Not started | Simulate slot selection + validation toasts. |
| Project Kanban board | `src/components/ProjectKanbanBoard.tsx` | Drag/drop ordering, status filtering, performance memoization | Medium | Not started | Use DnD testing helpers; ensure optimistic UI reverts on error. |
| Workflow health dashboard | `src/components/WorkflowHealthDashboard.tsx` | Status aggregations, error states, filter interactions | Medium | Not started | Snapshot metrics for empty vs populated data. |
| Global search | `src/components/GlobalSearch.tsx` | Debounced queries, status preload, keyboard navigation | High | Not started | Mock Supabase search results + user input events. |
| Protected route guard | `src/components/ProtectedRoute.tsx` | Auth gating, redirect logic, loading fallback | Medium | Done | Covered by `src/components/__tests__/ProtectedRoute.test.tsx` (loading/redirect + onboarding guard). |
| Route prefetcher | `src/components/RoutePrefetcher.tsx` | Prefetch orchestration, duplicate avoidance | Medium | Done | Covered by `src/components/__tests__/RoutePrefetcher.test.tsx` (cache guard + Supabase prefetch). |
| Offline banner | `src/components/OfflineBanner.tsx` | Connectivity context integration, retry actions | Low | Done | Covered by `src/components/__tests__/OfflineBanner.test.tsx` (online skip + retry + spinner state). |
| Lead detail page | `src/pages/LeadDetail.tsx` | Data loading, tab switching, error fallbacks | High | Not started | Mock services + ensure skeleton vs content transitions. |
| Project detail page | `src/pages/ProjectDetail.tsx` | Combined queries, session/payment sections, modals | High | Not started | Assert page handles missing project gracefully. |
| Calendar page | `src/pages/Calendar.tsx` | Range filters, session grouping, performance panels | High | Not started | Use fake timers to cover performance overlay toggles. |
| Upcoming sessions page | `src/pages/UpcomingSessions.tsx` | Filters, session sorting, empty state messaging | Medium | Not started | Ensure sessions from multiple statuses render correctly. |
| Templates workspace | `src/pages/Templates.tsx` | Block editor integration, preview data toggles | Medium | Not started | Mock template utils + i18n to confirm fallback content. |
| Session types settings | `src/components/SessionTypesSection.tsx` | CRUD workflows, default selection, empty states | High | Done | Covered by `src/components/__tests__/SessionTypesSection.test.tsx` (empty state, default toggle, activation toggle, deletion). |
| Session form fields | `src/components/SessionFormFields.tsx` | Validation messaging, timezone-aware inputs, reminders toggles | Medium | Done | Covered by `src/components/__tests__/SessionFormFields.test.tsx` (project selector + field callbacks). |
| Session status badge | `src/components/SessionStatusBadge.tsx` | Lifecycle color mapping, accessible labels | Low | Done | Covered by `src/components/__tests__/SessionStatusBadge.test.tsx` (loading badge + editable dropdown updates). |
| Project payments section | `src/components/ProjectPaymentsSection.tsx` | Summary cards, refresh triggers, empty states | Medium | Done | Covered by `src/components/__tests__/ProjectPaymentsSection.test.tsx` for metrics, refresh callback, and empty state. |
| Sessions section surface | `src/components/SessionsSection.tsx` | Tab filtering, sorting integration, quick actions | Medium | Not started | Stub hooks to return sample data + assert CTA availability. |
| Enhanced sessions section | `src/components/EnhancedSessionsSection.tsx` | Multi-column layout, performance instrumentation | Medium | Done | Covered by `src/components/__tests__/EnhancedSessionsSection.test.tsx` verifying lifecycle sorting, count badge, and click wiring. |
| Unified client details | `src/components/UnifiedClientDetails.tsx` | Conditional rendering of contact info, copy buttons | Low | Not started | Verify fallback text when data missing. |
| Project sheet view | `src/components/ProjectSheetView.tsx` | Printable layout, localization of labels, totals | Medium | Not started | Snapshot layout with English/Turkish translations. |
| Onboarding modal | `src/components/OnboardingModal.tsx` | Step transitions, skip behavior, analytics events | Medium | Not started | Mock context + ensure stage transitions call hooks. |
| Dead simple session banner | `src/components/DeadSimpleSessionBanner.tsx` | Feature flag handling, CTA availability, close persistence | Low | Not started | Confirm banner hides once dismissed per user. |
| App sidebar | `src/components/AppSidebar.tsx` | Active route highlighting, role-based menu items | High | Not started | Mock router + auth roles to confirm navigation gating. |

### UI Primitives & Shared Components
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Sheet modal wrapper | `src/components/ui/app-sheet-modal.tsx` | Mobile vs desktop render paths, aria attributes | Medium | Not started | Verify focus trap + escape behavior. |
| Data table core | `src/components/ui/data-table.tsx` | Column sorting, selection state, virtualization slots | High | Not started | Use Testing Library + fake data to confirm interactions. |
| Data table container | `src/components/ui/data-table-container.tsx` | Responsive layout, toolbar slots, sticky headers | Medium | Not started | Snapshot narrow vs wide viewports. |
| Date/time picker | `src/components/ui/date-time-picker.tsx` | Timezone defaults, validation boundaries | Medium | Not started | Mock date to ensure min/max enforcement. |
| KPI presets | `src/components/ui/kpi-presets.ts` | Metric formatting, threshold coloring | Low | Done | Covered by `src/components/ui/__tests__/kpi-presets.test.ts` (base classes + overrides). |
| Loading presets | `src/components/ui/loading-presets.tsx` | Skeleton variants, accessibility roles | Low | Not started | Snapshot skeleton markup for regression protection. |
| Toast hook | `src/components/ui/use-toast.ts` | Queue handling, duplicate suppression, dismissal timers | Medium | Not started | Use fake timers to verify auto-dismiss + manual close. |
| Toast renderer | `src/components/ui/toaster.tsx` | Mount/unmount behavior, focus management | Medium | Not started | Ensure toasts remain accessible via keyboard navigation. |
### Supabase Edge Functions & Automation
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Workflow executor | `supabase/functions/workflow-executor/index.ts` | Trigger filtering, duplicate prevention, action switch | High | Not started | Use Deno test harness; stub Supabase admin client responses. |
| Session reminder processor | `supabase/functions/process-session-reminders/index.ts` | Due reminder selection, workflow invocation, failure handling | High | Not started | Simulate mixed reminder payloads, ensure status updates idempotent. |
| Reminder notifications sender | `supabase/functions/send-reminder-notifications/index.ts` | Email templating branches, batch mode, auth flows | High | Not started | Mock Resend + Supabase admin; cover each `type` branch. |
| Notification queue processor | `supabase/functions/notification-processor/index.ts` | Queue polling, retry logic, failure escalation | Medium | Not started | Validate exponential backoff + dead-letter handling. |
| Daily scheduling cron | `supabase/functions/schedule-daily-notifications/index.ts` | Window calculations, dedupe of scheduled jobs | Medium | Not started | Provide fake clock to cover weekend/holiday scenarios. |
| Simplified daily scheduler | `supabase/functions/simple-daily-notifications/index.ts` | Lightweight cron fallback, idempotent inserts | Low | Not started | Ensure it exits early when main scheduler already ran. |
| Template email sender | `supabase/functions/send-template-email/index.ts` | Template lookup, localization, Resend payload | High | Not started | Stub template data + ensure placeholders resolve. |
| User email lookup | `supabase/functions/get-users-email/index.ts` | Auth enforcement, filtering, pagination | Medium | Not started | Mock Supabase admin client returning varying roles. |
| Test callback harness | `supabase/functions/test-callback/index.ts` | Echo behavior, validation of payload schema | Low | Not started | Keep as sanity check for function invocation plumbing. |

_Statuses_: `Not started`, `In progress`, `Blocked`, `Ready for review`, `Done`. Update the relevant table after every iteration that touches a listed area; add new rows when new risk surfaces.

## How We Work Iteratively
1. **Before coding**: Pick an item, confirm or adjust its priority/notes, and announce in the PR description.
2. **During implementation**: Keep `src/utils/testUtils.tsx` helpers in mind; extend them if setup becomes noisy.
3. **After implementation**: Run `npm run test`; capture pass/fail output in the PR description and update the status table.
4. **Documentation touchpoint**: Add a bullet to the Iteration Log (below) with date, scope, and outcomes (tests added, gaps, follow-up).
5. **Follow-up tasks**: If something stays untested, file an explicit TODO row or GitHub issue link so it doesn’t vanish.

## Iteration Log
| Date | Owner | Scope | Outcome | Follow-up |
| --- | --- | --- | --- | --- |
| 2025-09-14 | Codex | Created initial testing strategy, inventory, and workflow checklist | Plan ready for review; no tests added yet | Populate owners/priorities once first test task begins |
| 2025-09-14 (later) | Codex | Expanded inventory to cover contexts, services, UI, and Supabase automation | Added multi-section target tables with priorities and notes | Review priorities with Tayte and assign owners in next iteration |
| 2025-09-14 (late) | Codex | Documented test harness choices and deepened inventory for hooks, UI primitives, and edge functions | Added harness guidance plus ~20 new targets spanning high-risk areas | Circle back to assign owners + integrate harness setup into tooling work |
| 2025-09-14 (night) | Codex | Wired Jest command and ESM-friendly config, added mocks | `npm run test` now passes (no tests yet) using SWC + jsdom | Document custom render helper + finalize test file convention |
| 2025-09-14 (late night) | Codex | Added GitHub Actions Jest workflow and Deno smoke harness | CI runs `npm test`; `deno task test` exercises functions scaffold | Start implementing High-priority unit tests |
| 2025-09-15 | Codex | Added Jest coverage for locale/time helpers | `src/lib/utils.test.ts` validates 12/24h formatting + week boundaries | Next: cover org caching utilities |
| 2025-09-15 (later) | Codex | Added tests for organization ID caching helper | `src/lib/organizationUtils.test.ts` covers cache reuse + org creation errors | Move on to organization settings hook |
| 2025-09-15 (even later) | Codex | Added React Query hook coverage for organization settings | `src/hooks/__tests__/useOrganizationSettings.test.tsx` asserts cache hydration, update/upsert, and error toasts | Next: tackle session form workflow |
| 2025-09-15 (late night) | Codex | Added session form workflow tests | `src/hooks/__tests__/useSessionForm.test.tsx` covers validation, Supabase payloads, trigger failure recovery | Next: move to reminder scheduling hook |
| 2025-09-15 (night) | Codex | Added session reminder scheduling tests | `src/hooks/__tests__/useSessionReminderScheduling.test.tsx` covers RPC success/fail, cancel + reschedule flows | Next: target service layer (ProjectService) |
| 2025-09-16 | Codex | Added aggregation coverage for ProjectService | `src/services/__tests__/ProjectService.test.ts` validates active/archived merge + filtering | Next: continue through remaining service targets |
| 2025-09-16 (later) | Codex | Added SessionService tests | `src/services/__tests__/SessionService.test.ts` checks archived filtering + filters/sorting | Next: move on to LeadService |
| 2025-09-16 (night) | Codex | Added LeadService tests | `src/services/__tests__/LeadService.test.ts` covers custom-field merge + filter/sort | Next: shift focus to components/UI |
| 2025-09-16 (late night) | Codex | Added Schedule Session dialog tests | `src/components/__tests__/ScheduleSessionDialog.test.tsx` + sheet coverage for open/dirty flow | Next: continue UI inventory |
| 2025-09-17 | Codex | Added SessionActions hook tests | `src/hooks/__tests__/useSessionActions.test.tsx` covers delete failure + status workflows | Next: tackle remaining utility modules |
| 2025-09-17 (later) | Codex | Added organization settings cache tests | `src/lib/__tests__/organizationSettingsCache.test.ts` verifies TTL/localStorage + inflight dedupe | Next: move to date utilities |
| 2025-10-25 | Codex | Added timezone utility coverage | `src/lib/dateFormatUtils.test.ts` exercises formatting fallbacks, timezone conversions, and detection helpers | Revisit if new formats/timezones are introduced |
| 2025-10-25 (later) | Codex | Added dynamic lead validation coverage | `src/lib/leadFieldValidation.test.ts` covers schema generation, sanitization, parsing, and validation helpers | Monitor if new field types or validation rules are introduced |
| 2025-10-25 (even later) | Codex | Added organization data helper coverage | `src/hooks/__tests__/useOrganizationData.test.ts` verifies org guards, ensure_* RPC calls, and placeholder handling | Re-run if new org-scoped queries land |
| 2025-10-25 (late) | Codex | Added workflow trigger wrapper coverage | `src/hooks/__tests__/useWorkflowTriggers.test.ts` checks validation, RPC errors, toast suppression, and wrapper payloads | Extend if new trigger types are introduced |
| 2025-10-25 (night) | Codex | Added user preferences hook coverage | `src/hooks/__tests__/useUserPreferences.test.ts` exercises bootstrap defaults, optimistic updates, error rollback, and cache helpers | Revisit when new preference fields are persisted |
| 2025-10-25 (late night) | Codex | Added lead status actions coverage | `src/hooks/__tests__/useLeadStatusActions.test.tsx` validates status updates, undo flow, auth guard, and destructive toasts | Extend when new status workflows land |
| 2025-10-25 (even later) | Codex | Added entity data helper coverage | `src/hooks/__tests__/useEntityData.test.tsx` covers toast fallback, dependency-triggered refetch, and custom error handler behavior | Revisit if hook gains additional options |
| 2025-10-25 (night late) | Codex | Added lead detail aggregator coverage | `src/hooks/__tests__/useLeadDetailData.test.tsx` validates metrics computation, combined queries, and refetch fan-out | Extend if summary payload shape changes |
| 2025-10-25 (almost midnight) | Codex | Added session edit form coverage | `src/hooks/__tests__/useSessionEditForm.test.tsx` checks dirty tracking, validation errors, workflow trigger + reminder paths | Revisit when edit form adds new fields |
| 2025-10-25 (midnight) | Codex | Added lead detail service coverage | `src/services/__tests__/LeadDetailService.test.ts` covers fetch helpers, archived filtering, payment aggregation, and activity fallbacks | Extend when service gains additional data sources |
| 2025-10-25 (late night) | Codex | Added reminder actions coverage | `src/hooks/__tests__/useReminderActions.test.ts` verifies delete/update success toasts, null handling, and error paths | Extend if reminder actions gain additional mutations |
| 2025-10-25 (past midnight) | Codex | Added project payments hook coverage | `src/hooks/__tests__/useProjectPayments.test.tsx` aggregates totals, handles Supabase errors, and verifies refresh/refetch | Extend when payments logic adds currencies or statuses |
| 2025-10-25 (just after) | Codex | Added base entity service coverage | `src/services/__tests__/BaseEntityService.test.ts` validates org lookup failure handling and authenticated user guard | Revisit if service gains caching layers |
| 2025-10-25 (very late) | Codex | Added organization quick settings coverage | `src/hooks/__tests__/useOrganizationQuickSettings.test.tsx` ensures default fallback and refresh passthrough | Extend if quick settings grow beyond boolean toggles |
| 2025-10-25 (night owl) | Codex | Added organization timezone hook coverage | `src/hooks/__tests__/useOrganizationTimezone.test.ts` confirms settings-driven formats and browser fallback | Revisit when timezone settings grow more nuanced |
| 2025-10-25 (early morning) | Codex | Added notification triggers hook coverage | `src/hooks/__tests__/useNotificationTriggers.test.ts` validates milestone creation, scheduling, processing, and retry flows with error toasts | Extend when new trigger actions are added |
| 2025-10-25 (pre-dawn) | Codex | Added settings section manager coverage | `src/hooks/__tests__/useSettingsSection.test.ts` covers dirty tracking, manual and auto-save flows, and toast behaviors | Revisit if additional throttling options are introduced |
| 2025-10-25 (early morning++) | Codex | Added template validation hook + calendar monitor coverage | `src/hooks/__tests__/useTemplateValidation.test.ts` and `src/hooks/__tests__/useCalendarPerformanceMonitor.test.ts` ensure validation warnings and performance monitoring warnings | Extend when validation or monitoring logic expands |
| 2025-10-25 (sunrise) | Codex | Added template validation hook coverage | `src/hooks/__tests__/useTemplateValidation.test.ts` checks required fields, placeholder usage, and published template safeguards | Extend if validation rules expand |
| 2025-10-25 (after midnight) | Codex | Added project sessions summary hook coverage | `src/hooks/__tests__/useProjectSessionsSummary.test.tsx` groups statuses, detects overdue/today/upcoming, and handles refresh triggers | Extend when summary introduces new status categories |
| 2025-10-25 (morning) | Codex | Added Session Types settings coverage | `src/components/__tests__/SessionTypesSection.test.tsx` ensures empty state, default assignment, activation toggle, and deletion flows | Revisit when session type UI adds drag/reorder or bulk actions |
| 2025-10-25 (late morning) | Codex | Added session lifecycle sorting coverage | `src/lib/sessionSorting.test.ts` exercises lifecycle prioritization, legacy fallbacks, and time-based ordering | Extend when additional lifecycle states are introduced |
| 2025-10-25 (mid-morning) | Codex | Added relative date helper coverage | `src/lib/dateUtils.test.ts` validates today/tomorrow/yesterday copy, overdue detection, and display classes | Revisit if relative copy or status strings change |
| 2025-10-25 (near noon) | Codex | Added session naming + input handler coverage | `src/lib/sessionUtils.test.ts` covers naming priority + trimming; `src/lib/inputUtils.test.ts` normalizes change/blur flows | Extend if additional handlers or naming rules appear |
| 2025-10-25 (midday) | Codex | Added template utilities, payment colors, and project summary builder coverage | `src/lib/templateUtils.test.ts`, `src/lib/paymentColors.test.ts`, and `src/lib/projects/buildProjectSummaryItems.test.tsx` validate helper fallbacks, palette safety, and summary chips/info renders | Revisit when template helpers gain new placeholders or summary chips change |
| 2025-10-25 (afternoon) | Codex | Added protected route, offline banner, and KPI preset coverage | `src/components/__tests__/ProtectedRoute.test.tsx`, `src/components/__tests__/OfflineBanner.test.tsx`, and `src/components/ui/__tests__/kpi-presets.test.ts` cover loading redirects, connectivity retries, and preset styling contracts | Revisit if onboarding flow or preset catalog changes |
| 2025-10-25 (late afternoon) | Codex | Added validation helpers, context coverage, and UI prefetch/status fields | `src/lib/validation.test.ts`, `src/contexts/__tests__/AuthContext.test.tsx`, `src/contexts/__tests__/OrganizationContext.test.tsx`, `src/contexts/__tests__/OnboardingContext.test.tsx`, plus `src/components/__tests__/RoutePrefetcher.test.tsx`, `src/components/__tests__/SessionStatusBadge.test.tsx`, and `src/components/__tests__/SessionFormFields.test.tsx` harden schema guards, auth/org onboarding flows, and booking UI surfaces | Revisit when validation, onboarding, or session UI flows expand |
| 2025-10-26 | Codex | Added ProjectPaymentsSection coverage | `src/components/__tests__/ProjectPaymentsSection.test.tsx` verifies summary cards, empty state, and refresh callback | Continue tackling SessionsSection and EnhancedSessionsSection components |
| 2025-10-26 (later) | Codex | Reconciled Contexts/Hooks snapshot with remaining gaps | Updated progress table to show TemplateBuilder hook still pending | Add tests for `useTemplateBuilder` hook |
| 2025-10-26 (even later) | Codex | Added SessionsSection coverage | `src/components/__tests__/SessionsSection.test.tsx` ensures loading skeleton, empty state messaging, and sheet interactions | Next: Extend coverage to EnhancedSessionsSection flows |
| 2025-10-26 (night) | Codex | Added EnhancedSessionsSection coverage | `src/components/__tests__/EnhancedSessionsSection.test.tsx` verifies lifecycle sorting order, count badge rendering, and banner click wiring | Next: Monitor virtualization thresholds or analytics hooks if they land |
| 2025-10-26 (late night+) | Codex | Added Enhanced lead edit dialog coverage | `src/components/__tests__/EnhancedEditLeadDialog.test.tsx` exercises prefill, dirty-state detection, validation errors, and Supabase update success toasts | Revisit when dynamic field schema or toast messaging changes |
| 2025-10-26 (early dawn) | Codex | Added EnhancedProjectDialog coverage | `src/components/__tests__/EnhancedProjectDialog.test.tsx` loads defaults and verifies cancel-driven reset flows | Monitor if project dialog gains new pricing or lead workflows |

## Maintenance Rules of Thumb
- Treat this file like the single source of truth for unit testing status—update it in the same PR as any test additions or strategy changes.
- When removing or refactoring tests, adjust both the inventory row and the Iteration Log so historical context remains.
- If a new high-risk area appears (e.g., new Supabase RPC, major hook), add it to the inventory before merging its feature.
- Keep the tone approachable (this doc doubles as an onboarding quickstart); if jargon slips in, add a short translation.
- Update the **Progress Snapshot** table after every iteration to reflect the latest done/total ratios.

## Helpful References
- `src/setupTests.ts`: global mocks for Supabase, React Router, and performance APIs.
- `src/utils/testUtils.tsx`: custom `render` helper with React Query + Router + Theme providers.
- `.codex/rules.md`: full rule set covering deployment expectations, testing requirements, and commit etiquette.
