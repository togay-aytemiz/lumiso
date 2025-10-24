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
- [ ] Add `"test": "jest"` (or equivalent) to `package.json` scripts so running tests is one command.
- [ ] Wire `setupTests.ts` into Jest (`setupFilesAfterEnv`) and ensure `tsconfig` includes test files.
- [ ] Configure CI to run `npm run test` on pull requests (reuse existing workflow if available).
- [ ] Document how to use `src/utils/testUtils.tsx` for provider-wrapped renders.
- [ ] Decide on the folder convention (`*.test.ts` beside file vs. `__tests__` directories) and stick to it.

## Test Target Inventory
| Area | File(s) | What to Cover | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Date/time formatting helpers | `src/lib/utils.ts` | Locale-aware formatting, 24h/12h detection, week range math | High | Not started | Mock `navigator.language` to cover EN vs TR paths. |
| Organization ID caching | `src/lib/organizationUtils.ts` | Cache hit/miss, Supabase auth fallback, error resilience | High | Not started | Stub Supabase auth + RPC calls; verify cache expiry resets. |
| Organization settings hook | `src/hooks/useOrganizationSettings.ts` | React Query caching, update path success/error toasts | High | Not started | Use Testing Library render hooks; assert cache writes. |
| Session form workflow | `src/hooks/useSessionForm.ts` | Validation guardrails, Supabase insert payload, workflow trigger recovery | High | Not started | Mock `supabase`, `triggerSessionScheduled`, and reminder hook. |
| Reminder scheduling hook | `src/hooks/useSessionReminderScheduling.ts` | RPC invoke, graceful error handling, reschedule flow | Medium | Not started | Spy on toast + Supabase chained calls. |
| Workflow trigger wrapper | `src/hooks/useWorkflowTriggers.ts` | Input validation (UUID), invoke payload, toast on failure | Medium | Not started | Ensure “no workflows” branch skips toast. |
| Lead status actions | `src/hooks/useLeadStatusActions.tsx` | Auth guard, optimistic flags, destructive toast action | Medium | Not started | Verify toast action surfaces undo handler when provided. |
| Organization settings cache | `src/lib/organizationSettingsCache.ts` | Memory vs localStorage sync, TTL expiry, inflight dedupe | Medium | Not started | Simulate `window`/storage; ensure stale entries purge. |
| Template validation utils | `src/lib/templateValidation.ts` | Required field enforcement, error aggregation | Low | Not started | Snapshot expected error objects. |
| Calendar performance monitor | `src/hooks/useCalendarPerformanceMonitor.ts` | Throttle thresholds, cleanup handlers | Low | Not started | Use fake timers to simulate long renders. |

_Statuses_: `Not started`, `In progress`, `Blocked`, `Ready for review`, `Done`. Update the table after every iteration that touches a listed area; add new rows as new risk areas surface.

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

## Maintenance Rules of Thumb
- Treat this file like the single source of truth for unit testing status—update it in the same PR as any test additions or strategy changes.
- When removing or refactoring tests, adjust both the inventory row and the Iteration Log so historical context remains.
- If a new high-risk area appears (e.g., new Supabase RPC, major hook), add it to the inventory before merging its feature.
- Keep the tone approachable (this doc doubles as an onboarding quickstart); if jargon slips in, add a short translation.

## Helpful References
- `src/setupTests.ts`: global mocks for Supabase, React Router, and performance APIs.
- `src/utils/testUtils.tsx`: custom `render` helper with React Query + Router + Theme providers.
- `.codex/rules.md`: full rule set covering deployment expectations, testing requirements, and commit etiquette.
