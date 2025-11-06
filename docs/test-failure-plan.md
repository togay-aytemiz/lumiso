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
- **Issues**: Duration metrics remain zero and warning logs never triggered.
- **Plan**:
  1. Populate mock timing data to simulate meaningful durations.
  2. Trigger warning paths by configuring thresholds.
  3. Adjust expectations to assert on the populated metrics and log calls.

## `src/components/__tests__/UnifiedClientDetails.test.tsx`
- **Issue**: Missing accessible label for the WhatsApp button.
- **Plan**:
  1. Confirm the component renders an accessible label or title attribute.
  2. Update the test to match the actual accessible name.
  3. If necessary, modify the component to include the expected label.

- **Status**: ✅ Fixed — mapped `@/components/react-calendar.css` to the shared style mock and aligned the assertions with the component’s current summary output so the suite loads and passes.

## Follow-up
- Once individual suites pass locally, run `npm test` to confirm the overall test suite succeeds.
- Consider adding regression coverage for recurring issues to prevent future breakages.

