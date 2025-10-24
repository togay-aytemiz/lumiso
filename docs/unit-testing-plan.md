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
- [ ] Configure CI to run `npm run test` on pull requests (reuse existing workflow if available).
- [ ] Document how to use `src/utils/testUtils.tsx` for provider-wrapped renders.
- [ ] Decide on the folder convention (`*.test.ts` beside file vs. `__tests__` directories) and stick to it.
- [ ] Configure Deno-based test runner for `supabase/functions/**` (`deno test --allow-env --allow-net` with local mocks).

### Test Harness Decisions
- Use **Jest 30 (Node + jsdom environment)** for everything under `src/**`, pairing it with Testing Library and our custom provider wrapper. Keep tests colocated with the code they cover.
- Use **Deno’s built-in test runner** for Supabase edge functions under `supabase/functions/**`. Author deterministic tests that stub the Supabase admin client and external services (Resend, fetch) via dependency injection or mock factories.
- When in doubt about where logic lives, prefer moving business rules into plain TypeScript modules so they are testable with Jest, leaving Deno functions as thin orchestrators.

## Test Target Inventory

### Core Libraries & Helpers
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Locale/date formatting helpers | `src/lib/utils.ts` | Locale-aware formatting, 24h/12h detection, week range math | High | Not started | Mock `navigator.language` to cover EN/TR paths. |
| Organization ID caching | `src/lib/organizationUtils.ts` | Cache hit/miss, Supabase auth fallback, error resilience | High | Not started | Stub Supabase auth + RPC calls; verify cache expiry resets. |
| Organization settings cache | `src/lib/organizationSettingsCache.ts` | Memory vs localStorage sync, TTL expiry, inflight dedupe | Medium | Not started | Simulate `window` storage; ensure stale entries purge. |
| Org-aware date/time utils | `src/lib/dateFormatUtils.ts` | Timezone conversions, format fallbacks, supported list ordering | High | Not started | Use fake timers + timezone mocks to hit edge cases. |
| Dynamic lead validation | `src/lib/leadFieldValidation.ts` | Schema generation per field type, sanitize/parse helpers | High | Not started | Cover required vs optional fields and number/date coercion. |
| Session lifecycle sorting | `src/lib/sessionSorting.ts` | Lifecycle grouping, legacy status mapping, timestamp ordering | Medium | Not started | Provide sample session arrays for deterministic snapshots. |
| Template validation helpers | `src/lib/templateValidation.ts` | Required field enforcement, error aggregation | Low | Not started | Snapshot expected error objects. |
| Template utilities | `src/lib/templateUtils.ts` | Placeholder fallbacks, spam word detection, block/plain conversions | Low | Not started | Mock `templateBlockUtils` import to validate legacy fallback path. |
| Session naming helpers | `src/lib/sessionUtils.ts` | Priority ordering (custom name, project type, lead), fallback behavior | Low | Not started | Table-driven tests for combinations of name/project/lead data. |
| Relative date helpers | `src/lib/dateUtils.ts` | Today/tomorrow/yesterday detection, overdue sessions flags | Medium | Not started | Freeze time to assert relative string outputs in EN/TR. |
| Input normalization utilities | `src/lib/inputUtils.ts` | Trimming handlers, blur normalization, event typing | Low | Not started | Simulate change/blur events to confirm whitespace handling. |
| Payment color mapping | `src/lib/paymentColors.ts` | Consistent status color lookups, fallback color selection | Low | Not started | Verify palette stays in sync with design tokens. |
| Project summary builder | `src/lib/projects/buildProjectSummaryItems.tsx` | Aggregate KPI rows, empty state handling | Medium | Not started | Mock project datasets to snapshot summary cards. |

### Services & Data Access
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Project data service | `src/services/ProjectService.ts` | Aggregated fetches, archived filtering, payment totals | High | Not started | Mock Supabase responses per query; assert merged shape. |
| Session data service | `src/services/SessionService.ts` | Filtering, archived project exclusion, lead enrichment | High | Not started | Cover lifecycle filtering + timeline ordering. |
| Lead data service | `src/services/LeadService.ts` | Search/filter combinations, pagination guards, Supabase fallbacks | High | Not started | Validate edge cases when no organization or lead. |
| Lead detail aggregator | `src/services/LeadDetailService.ts` | Parallel fetch composition, null safety when relations missing | Medium | Not started | Simulate partial responses to ensure graceful degradation. |
| Base entity service foundation | `src/services/BaseEntityService.ts` | Shared `getOrganizationId`, error handling, caching | Medium | Not started | Verify behavior when auth user missing or Supabase errors. |

### Contexts & Hooks
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Organization settings hook | `src/hooks/useOrganizationSettings.ts` | React Query caching, update path success/error toasts | High | Not started | Use Testing Library render hooks; assert cache writes. |
| Session form workflow | `src/hooks/useSessionForm.ts` | Validation guardrails, Supabase insert payload, workflow trigger recovery | High | Not started | Mock `supabase`, `triggerSessionScheduled`, and reminder hook. |
| Session reminder scheduling | `src/hooks/useSessionReminderScheduling.ts` | RPC invoke, graceful error handling, reschedule flow | Medium | Not started | Spy on toast + Supabase chained calls. |
| Workflow trigger wrapper | `src/hooks/useWorkflowTriggers.ts` | Input validation (UUID), invoke payload, toast on failure | Medium | Not started | Ensure “no workflows found” branch skips toast. |
| Lead status actions | `src/hooks/useLeadStatusActions.tsx` | Auth guard, optimistic flags, destructive toast action | Medium | Not started | Verify toast action surfaces undo handler when provided. |
| Session actions | `src/hooks/useSessionActions.ts` | Reminder cleanup, workflow triggers on status change | High | Not started | Cover delete + update flows with Supabase error branches. |
| Entity data helper | `src/hooks/useEntityData.ts` | Error propagation, dependency refresh behavior | Medium | Not started | Mock `toast` and confirm custom error callbacks short-circuit. |
| User preferences hook | `src/hooks/useUserPreferences.ts` | Default bootstrap, optimistic updates, retry strategy | High | Not started | Use mocked React Query to assert cache mutations. |
| Auth provider | `src/contexts/AuthContext.tsx` | Role fetching, auth change handling, sign-out side effects | High | Not started | Mock auth listener + RPC; ensure localStorage cleared on sign-out. |
| Organization provider | `src/contexts/OrganizationContext.tsx` | Initial load, presence heartbeat cleanup, data prefetch | High | Not started | Fake timers to confirm interval cleanup and toast behavior. |
| Onboarding provider | `src/contexts/OnboardingContext.tsx` | Computed flags, guarded transitions, batch completion | Medium | Not started | Provide fixture preferences to cover each onboarding stage. |
| Calendar performance monitor | `src/hooks/useCalendarPerformanceMonitor.ts` | Throttle thresholds, cleanup handlers | Low | Not started | Use fake timers to simulate long renders. |
| Organization data query helper | `src/hooks/useOrganizationData.ts` | Active org guards, queryKey composition, Supabase ensures | High | Not started | Mock failing org lookups to ensure descriptive errors. |
| Lead detail data aggregator | `src/hooks/useLeadDetailData.ts` | Session metrics, combined queries, refetch fan-out | High | Not started | Provide fixture services to verify metrics math. |
| Session edit form | `src/hooks/useSessionEditForm.ts` | Dirty tracking, Zod validation, reschedule workflow path | High | Not started | Mock sanitize helpers + Supabase update/reschedule calls. |
| Reminder actions | `src/hooks/useReminderActions.ts` | Delete/update mutations, toast feedback, error handling | Medium | Not started | Stub Supabase `.delete()`/`.update()` to throw vs succeed. |
| Project payments hook | `src/hooks/useProjectPayments.ts` | Aggregated totals, missing services/payments fallback | Medium | Not started | Mock chained Supabase queries returning null arrays. |
| Project sessions summary hook | `src/hooks/useProjectSessionsSummary.ts` | Status grouping, overdue detection, refresh triggers | Medium | Not started | Freeze dates to assert metrics snapshot. |
| Organization quick settings | `src/hooks/useOrganizationQuickSettings.ts` | Memo defaults, refresh passthrough | Low | Not started | Ensure fallback true when setting undefined. |
| Organization timezone | `src/hooks/useOrganizationTimezone.ts` | Format conversion helpers, detect fallback timezone | Medium | Not started | Mock settings to cover 12/24 hour + timezone edge cases. |
| Notification triggers | `src/hooks/useNotificationTriggers.ts` | Milestone notifications, batch scheduling, toast errors | Medium | Not started | Spy on Supabase functions.invoke to capture payloads. |
| Settings section manager | `src/hooks/useSettingsSection.ts` | Auto-save throttling, dirty tracking, toast toggles | Medium | Not started | Use fake timers to validate throttled saves + cleanup. |
| Template builder hook | `src/hooks/useTemplateBuilder.ts` | Load/save pipelines, placeholder extraction, publish flow | High | Not started | Mock Supabase responses + ensure blocks conversions happen. |
| Template validation hook | `src/hooks/useTemplateValidation.ts` | Warning/error matrix, published template requirements | Medium | Not started | Table-driven tests for inputs covering each branch. |

### UI Components & Pages
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Enhanced lead creation | `src/components/EnhancedAddLeadDialog.tsx` | Dynamic schema init, default status lookup, save pipeline | High | Not started | Mock field definitions + Supabase inserts; assert dirty guard. |
| Enhanced lead edit | `src/components/EnhancedEditLeadDialog.tsx` | Prefill logic, change detection, update mutation flow | High | Not started | Cover validation errors + success toast. |
| Enhanced project dialog | `src/components/EnhancedProjectDialog.tsx` | Cross-entity linking, lead selection, Supabase upserts | High | Not started | Validate state reset on close/open cycles. |
| Session scheduling dialog | `src/components/ScheduleSessionDialog.tsx` | Prefill data, reminder scheduling hooks, status updates | High | Not started | Mock `useSessionForm` integration path. |
| Session scheduling sheet | `src/components/SessionSchedulingSheet.tsx` | Mobile sheet state, timezone-aware slots, submission flow | Medium | Not started | Simulate slot selection + validation toasts. |
| Project Kanban board | `src/components/ProjectKanbanBoard.tsx` | Drag/drop ordering, status filtering, performance memoization | Medium | Not started | Use DnD testing helpers; ensure optimistic UI reverts on error. |
| Workflow health dashboard | `src/components/WorkflowHealthDashboard.tsx` | Status aggregations, error states, filter interactions | Medium | Not started | Snapshot metrics for empty vs populated data. |
| Global search | `src/components/GlobalSearch.tsx` | Debounced queries, status preload, keyboard navigation | High | Not started | Mock Supabase search results + user input events. |
| Protected route guard | `src/components/ProtectedRoute.tsx` | Auth gating, redirect logic, loading fallback | Medium | Not started | Verify redirect when user lacks session/role. |
| Route prefetcher | `src/components/RoutePrefetcher.tsx` | Prefetch orchestration, duplicate avoidance | Medium | Not started | Spy on query client to ensure only unique prefetches fire. |
| Offline banner | `src/components/OfflineBanner.tsx` | Connectivity context integration, retry actions | Low | Not started | Mock context toggles to ensure banner visibility flips. |
| Lead detail page | `src/pages/LeadDetail.tsx` | Data loading, tab switching, error fallbacks | High | Not started | Mock services + ensure skeleton vs content transitions. |
| Project detail page | `src/pages/ProjectDetail.tsx` | Combined queries, session/payment sections, modals | High | Not started | Assert page handles missing project gracefully. |
| Calendar page | `src/pages/Calendar.tsx` | Range filters, session grouping, performance panels | High | Not started | Use fake timers to cover performance overlay toggles. |
| Upcoming sessions page | `src/pages/UpcomingSessions.tsx` | Filters, session sorting, empty state messaging | Medium | Not started | Ensure sessions from multiple statuses render correctly. |
| Templates workspace | `src/pages/Templates.tsx` | Block editor integration, preview data toggles | Medium | Not started | Mock template utils + i18n to confirm fallback content. |
| Session types settings | `src/components/SessionTypesSection.tsx` | CRUD workflows, default selection, empty states | High | Not started | Mock Supabase mutations + ensure optimistic UI rollback. |
| Session form fields | `src/components/SessionFormFields.tsx` | Validation messaging, timezone-aware inputs, reminders toggles | Medium | Not started | Use Testing Library form interactions to assert field errors. |
| Session status badge | `src/components/SessionStatusBadge.tsx` | Lifecycle color mapping, accessible labels | Low | Not started | Snapshot statuses to catch inadvertent color swaps. |
| Project payments section | `src/components/ProjectPaymentsSection.tsx` | Summary cards, refresh triggers, empty states | Medium | Not started | Mock `useProjectPayments` to emit various totals. |
| Sessions section surface | `src/components/SessionsSection.tsx` | Tab filtering, sorting integration, quick actions | Medium | Not started | Stub hooks to return sample data + assert CTA availability. |
| Enhanced sessions section | `src/components/EnhancedSessionsSection.tsx` | Multi-column layout, performance instrumentation | Medium | Not started | Ensure virtualization thresholds + analytics logging. |
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
| KPI presets | `src/components/ui/kpi-presets.ts` | Metric formatting, threshold coloring | Low | Not started | Provide sample metric arrays, compare to expected config. |
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
| 2025-09-14 (night) | Codex | Wired Jest command and ESM-friendly config, added mocks | `npm run test` now passes (no tests yet) using SWC + jsdom | Next: add CI step and Deno harness |

## Maintenance Rules of Thumb
- Treat this file like the single source of truth for unit testing status—update it in the same PR as any test additions or strategy changes.
- When removing or refactoring tests, adjust both the inventory row and the Iteration Log so historical context remains.
- If a new high-risk area appears (e.g., new Supabase RPC, major hook), add it to the inventory before merging its feature.
- Keep the tone approachable (this doc doubles as an onboarding quickstart); if jargon slips in, add a short translation.

## Helpful References
- `src/setupTests.ts`: global mocks for Supabase, React Router, and performance APIs.
- `src/utils/testUtils.tsx`: custom `render` helper with React Query + Router + Theme providers.
- `.codex/rules.md`: full rule set covering deployment expectations, testing requirements, and commit etiquette.
