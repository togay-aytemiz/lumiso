# Lumiso Testing Quickstart

This guide summarizes the most common ways to run the Jest test suite that powers Lumiso.
Each section includes typical use cases and example commands you can run from the project
root.

## Prerequisites

- Install dependencies (one-time):
  ```bash
  npm install
  ```
- All commands below assume you are in the repository root (`/workspace/lumiso`).

## Run the Entire Test Suite

Use this when you want a full regression pass (for example, before opening a pull request).

```bash
npm test
```

This executes Jest with the options defined in `package.json`, including `--runInBand` to
run tests serially and `--passWithNoTests` to avoid failures if no files match.

### Common Variations

| Goal | Command |
| --- | --- |
| Collect open handles to diagnose hangs | `npm test -- --detectOpenHandles` |
| Stop after the first failure | `npm test -- --bail` |
| Run with verbose per-test output | `npm test -- --verbose` |

## List Every Discovered Test File

Use this when you need a high-level inventory of all suites Jest would run.

```bash
npm test -- --listTests
```

Jest prints the absolute path of every matched spec without executing them, allowing you to
plan targeted runs or split work among teammates.

## Run Page-Level Tests

Use this to focus on UI flows under `src/pages/`—helpful when iterating on page
components or reproducing page-specific regressions.

```bash
npm test -- --testPathPattern=src/pages
```

Because the project’s Jest configuration matches files inside `__tests__` folders and
`*.test.ts(x)` files, the pattern above captures all page suites.

### Examples

| Scenario | Command |
| --- | --- |
| Only the Template Builder page tests | `npm test -- src/pages/__tests__/TemplateBuilder.test.tsx` |
| Page tests plus admin sub-pages | `npm test -- --testPathPattern='src/pages(/admin)?'` |

## Run Narrower Test Groups

When you need to zero in on specific functionality, refine the `--testPathPattern`
substring (or pass explicit file paths) to limit execution.

```bash
# Hooks under src/hooks
npm test -- --testPathPattern=src/hooks

# Payments page hooks
npm test -- --testPathPattern=src/pages/payments/hooks

# Single hook test file
npm test -- src/hooks/__tests__/usePaymentsTableColumns.test.tsx
```

### Additional Filtering

Combine file-level targeting with Jest’s name filtering and listing features:

```bash
# Preview which tests will run for a pattern without executing them
npm test -- --testPathPattern=src/hooks --listTests

# Run only tests whose name contains "creates draft filters"
npm test -- src/components/data-table/__tests__/useDraftFilters.test.tsx --testNamePattern "creates draft filters"
```

These techniques let you bisect problematic suites quickly and iterate on fixes without
running the entire suite every time.
