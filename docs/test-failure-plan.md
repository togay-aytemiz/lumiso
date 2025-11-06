# Test Failure Remediation Plan

This document outlines proposed fixes for each test suite currently failing or blocked. Each section summarizes the suspected cause and provides actionable steps to resolve the issue.

## `src/pages/settings/__tests__/Account_old.test.tsx`
- **Status**: ✅ Passing — confirmed the legacy settings suite now initializes all mocks and succeeds without additional work.

## `src/components/settings/__tests__/ProjectTypeDialogs.test.tsx`
- **Status**: ✅ Passing — verified the dialog interactions and Supabase mocks are already in place and the suite runs green.

## `src/pages/__tests__/AllLeads.test.tsx`
- **Status**: ✅ Passing — the filters and tutorial flow now execute without reference errors.

## `src/pages/__tests__/ProjectDetail.test.tsx`
- **Status**: ✅ Passing — loading and navigation scenarios complete with the expected pipeline markup.

## `src/components/__tests__/ActivitySection.test.tsx`
- **Status**: ✅ Passing — activity fetching and creation scenarios run with the existing mocks.

## `src/components/__tests__/LeadActivitySection.test.tsx`
- **Status**: ✅ Fixed — updated the Supabase audit log mock to cycle through lead, project, and session lookups on each refresh so the suite can refetch without triggering console errors.

## `src/pages/admin/__tests__/Localization.test.tsx`
- **Status**: ✅ Fixed — ensured Supabase mocks return language data and invoked the segment/toggle callbacks directly in tests so the table populates and updates correctly.

## `src/pages/__tests__/Analytics.test.tsx`
- **Status**: ✅ Fixed — restructured the component so `fetchAnalyticsData` is defined before it is used, gated follow-up effects on the loading flag, and hardened error handling for mocked Supabase responses.

## `src/components/template-builder/__tests__/ImageLibrarySheet.test.tsx`
- **Status**: ✅ Fixed — stabilized the loading state guard so the gallery renders once assets arrive and enforced explicit button types so all controls, including “Delete image”, respond inside the tests.

## `src/utils/performance.test.tsx`
- **Status**: ✅ Fixed — populated deterministic timing data for the monitor and now assert that the captured metric values match the computed duration, ensuring we exercise the warning path and prevent regressions where durations stay at zero.

## `src/components/__tests__/UnifiedClientDetails.test.tsx`
- **Status**: ✅ Verified — quick action links expose the translated accessibility labels in both expanded and compact modes, so the suite’s assertions align with the component output and pass consistently.

## `src/components/__tests__/ProjectSheetView.test.tsx`
- **Status**: ✅ Passing — re-running the suite now exercises the archive toggle path successfully with the mocked outstanding payments scenario.
- **Notes**: `npx jest --runInBand src/components/__tests__/ProjectSheetView.test.tsx`

## `src/pages/payments/hooks/__tests__/usePaymentsData.test.ts`
- **Status**: ✅ Passing — the composed filter string now matches the expected search, type, and amount clauses, so the Supabase builder mock assertions succeed.
- **Notes**: `npx jest --runInBand src/pages/payments/hooks/__tests__/usePaymentsData.test.ts`

## `src/components/__tests__/EnhancedAddLeadDialog.test.tsx`
- **Status**: ✅ Passing — the dialog now hydrates the default status before saving, and the mocked insert path confirms the expected `status_id`.
- **Notes**: `npx jest --runInBand src/components/__tests__/EnhancedAddLeadDialog.test.tsx`

## Follow-up
- Stabilized the previously noisy suites:
  - `TemplateBuilderAssets.test.tsx` now mocks the `CompactStorageIndicator` module instead of the unused `StorageQuotaDisplay` stub and silences expected error logs when simulating failed Supabase calls, eliminating the infinite loop of `select is not a function` messages.
  - `TemplatePreview.test.tsx` exercises the error path without emitting invalid DOM warnings by rendering bullet lists with proper markup and capturing the expected console error when the Supabase function rejects.
  - `AllProjects.test.tsx` wraps view toggles in `act(...)` and suppresses the intentional export failure log so the suite no longer triggers React's act warnings.
- A fresh `npm test -- --runInBand --passWithNoTests` run advances past these suites but still required a manual cancel after the runner stopped reporting progress. Remaining noise comes from unrelated suites (for example `TemplateBuilder.test.tsx` and `SessionTypesSection.test.tsx`) that emit `act(...)` and DOM nesting warnings, which should be the next targets to keep Jest from hanging.
- **2024-10-05** — Re-ran `npm test` and observed the same behavior: hundreds of suites pass, but Jest eventually stalls on an unspecified suite (the reporter displays only `RUNS  ...`) while the process spins the CPU. No actual assertion failures surfaced before the hang. Next debugging step is to enable `--detectOpenHandles` or bisect by directory to isolate the suite that leaves pending timers or promises.
- **2025-11-06** — Ran `npm test -- src/components/__tests__/ProjectKanbanBoard.test.tsx --detectOpenHandles`. The suite spammed "Maximum update depth exceeded" warnings from `ProjectKanbanBoard.tsx` and never exited despite Jest printing no open-handle summary, confirming the infinite render loop lives inside this spec/component pairing. Next action: audit the `useEffect` that sets `statuses` in `ProjectKanbanBoard` and mirror the production guardrails in the test (e.g., seed archived statuses or stub `toast`) so the effect stops calling `setStatuses` every render.
- **2025-11-07** — Stabilized the test double for `useI18nToast` so it returns a memoized object and added a diff check before `setStatuses` re-applies provided statuses. Re-running `npm test -- src/components/__tests__/ProjectKanbanBoard.test.tsx --detectOpenHandles` now completes cleanly with all four assertions passing and no lingering open handle output, unblocking a fresh full-suite attempt.
- **2025-11-07** — Kicked off the full suite with `npm test -- --detectOpenHandles`. Jest surfaced real failures before the runner stalled again: `useNotificationTriggers.test.ts` now expects refined destructive toast copy (`status fetch failed`, `invoke failed`, etc.), `ServiceInventorySelector.test.tsx` cannot locate the Crew/Equipment quantity triggers, `SummaryStep.test.tsx` renders outside the `PackageCreationProvider`, and `SettingsLayout.test.tsx` dereferences `categoryChanges[currentPath]` without a guard. After these failures the reporter sat on `RUNS ...` until manually cancelled, so address the failing suites first, then retry the full run to confirm the hang is gone.
- Consider adding regression coverage for recurring issues to prevent future breakages.

