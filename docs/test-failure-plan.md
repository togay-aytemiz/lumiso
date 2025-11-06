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
- A full `npm test` run currently completes the majority of suites but needs additional time ( >5 minutes) to finish; the latest attempt was interrupted after observing only passing suites. Re-run when more time is available to confirm completion.
- Consider adding regression coverage for recurring issues to prevent future breakages.

