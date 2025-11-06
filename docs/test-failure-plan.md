# Test Failure Remediation Plan

This document outlines proposed fixes for each test suite currently failing or blocked. Each section summarizes the suspected cause and provides actionable steps to resolve the issue.

## `src/pages/settings/__tests__/Account_old.test.tsx`
- **Issue**: `mockUseProfile` is not defined as a Jest mock before invoking `mockReturnValue`.
- **Plan**:
  1. Convert the `mockUseProfile` import or variable to `jest.fn()` before use.
  2. Ensure the mock is reset between tests to avoid leaked state.
  3. Re-run the suite to confirm the setup succeeds.

## `src/components/settings/__tests__/ProjectTypeDialogs.test.tsx`
- **Issues**: Missing `type`/`useModalNavigationMock` setup and unchecked form data.
- **Plan**:
  1. Review the module mocks to provide explicit exports for `type` and `useModalNavigationMock`.
  2. Adjust test helpers to populate required form fields before submit events.
  3. Validate that dialog interactions close or resolve as expected.

## `src/pages/__tests__/AllLeads.test.tsx`
- **Issue**: `buttonGlobals` referenced before initialization.
- **Plan**:
  1. Identify where `buttonGlobals` should be mocked or imported.
  2. Add the necessary mock initialization prior to usage.
  3. Verify rendering proceeds without reference errors.

## `src/pages/__tests__/ProjectDetail.test.tsx`
- **Issue**: Fails to find the `stage-pipeline` element.
- **Plan**:
  1. Confirm the component renders the pipeline under current props.
  2. Update the test to await async rendering or adjust selectors.
  3. Ensure fixture data produces the expected DOM structure.

## `src/components/__tests__/ActivitySection.test.tsx`
- **Issue**: `useToastMock` referenced before definition.
- **Plan**:
  1. Ensure mock declarations appear before they are consumed.
  2. Replace direct references with `jest.fn()` mocks where appropriate.
  3. Re-run the suite to ensure the module loads.

## `src/components/__tests__/LeadActivitySection.test.tsx`
- **Issues**: Supabase mock API mismatches and incorrect call-count expectations.
- **Plan**:
  1. Align Supabase client mocks with actual API signatures.
  2. Update expectations to reflect the actual number of invocations.
  3. Add assertions that validate key behavior without over-constraining call counts.

## `src/pages/admin/__tests__/Localization.test.tsx`
- **Issue**: Fails to locate expected “English” language rows.
- **Plan**:
  1. Inspect fixture data to ensure an English entry is provided.
  2. Adjust selectors or wait for asynchronous data loading.
  3. Confirm table rendering produces the expected row text.

## `src/pages/__tests__/Analytics.test.tsx`
- **Issue**: `fetchAnalyticsData` is undefined, causing a ReferenceError.
- **Plan**:
  1. Mock or import `fetchAnalyticsData` before executing tests.
  2. Provide deterministic mock return values for analytics data.
  3. Verify downstream assertions align with the mock payload.

## `src/components/template-builder/__tests__/ImageLibrarySheet.test.tsx`
- **Issue**: Cannot find the “Delete image” control.
- **Plan**:
  1. Ensure the component renders the control under test conditions.
  2. Update the test query to match the accessible label or text.
  3. Confirm delete flows dispatch the expected callbacks.

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

## `src/components/__tests__/ProjectPaymentsSection.test.tsx`
- **Issue**: Jest cannot parse imported `react-calendar.css`.
- **Plan**:
  1. Mock CSS imports via Jest configuration or local mock files.
  2. Add the necessary module mapper in `jest.config.js` or setup file.
  3. Re-run tests to verify the module loads without parsing errors.

## Follow-up
- Once individual suites pass locally, run `npm test` to confirm the overall test suite succeeds.
- Consider adding regression coverage for recurring issues to prevent future breakages.

