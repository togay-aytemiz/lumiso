# Codex Rules

Always review these before making any changes.

## Repo Quickstart

- Package manager: CI runs `npm ci` / `npm test` (Node 20). Use npm for dependency changes so `package-lock.json` stays correct; `bun.lockb` is ignored.
- Dev: `bun run dev` (or `npm run dev`)
- Lint: `npm run lint`
- Frontend tests: `npm test`
- Supabase function tests (Deno): `deno task test` (or `npm run test:deno`)
- Build/preview: `npm run build` + `npm run preview`

## Codebase Map

- App entry/routing: `src/main.tsx`, `src/App.tsx` (React Router)
- UI primitives (shadcn): `src/components/ui/**` (see `components.json` and `docs/design-system/README.md`)
- App components: `src/components/**`
- Feature modules: `src/features/**`
- Pages: `src/pages/**`
- Hooks: `src/hooks/**`
- Domain/data access: `src/services/**`, shared helpers in `src/lib/**`
- i18n resources: `src/i18n/resources/{en,tr}/*.json`
- Supabase: `src/integrations/supabase/**` (generated client/types), `supabase/functions/**` (Edge functions), `supabase/migrations/**`

## Task Completion

- At the end of every task that alters the repository, reply with a single-line commit message summarizing the change.
- Additional to single-line commit message, also share (aka add your reply message) a plain Turkish summary what you did, what is left (if exists) and maybe possible suggestions for next steps

## Guiding Principles

- Favor reusable components and clean abstractions; avoid one-off hacks or hardcoded logic.
- Keep the codebase DRY—refactor or consolidate duplication whenever practical.
- Solve issues at the root cause; no temporary workarounds or avoidable tech debt.
- Aim for production quality: scalable, reliable, stable, and future-proof solutions.
- Deliver professional polish without over-engineering; simple is best.
- Respect i18n: never hardcode user-facing strings; update all existing locales (EN and TR) when copy changes.

## i18n (UI + Email)

- UI copy: add/modify keys in both `src/i18n/resources/en/*.json` and `src/i18n/resources/tr/*.json` and use `useTranslation()` in components.
- Toasts/snackbars: prefer `useI18nToast` (`src/lib/toastHelpers.ts`) so titles stay localized.
- Email copy (Edge functions): update `supabase/functions/_shared/email-i18n.ts` and its tests when changing email templates.

## Supabase (DB + Edge Functions)

- Any change under `supabase/functions/**` (shared helpers and templates included) must be deployed after merge.
- Before deploying, confirm Supabase CLI is authenticated and linked: `npx supabase login`, `npx supabase link --project-ref rifdykpdubrowzbylffe`.
- After modifying Edge functions, run `deno task test` (or `npm run test:deno`) and ensure function-specific tests exist in `supabase/functions/tests/**`.
- Treat `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` as generated; prefer regenerating types via Supabase CLI when DB schema changes.

## Feature Flags

- Prefer guarded rollouts for risky/user-facing changes using `isFeatureEnabled()` and `FEATURE_FLAGS` in `src/lib/featureFlags.ts`.
- Env naming: `VITE_FEATURE_<FLAG_NAME>` (normalized); local overrides use `localStorage` key `flag:<flag>`.

## Process Expectations

- For multi-phase work, propose the plan and wait for Tayte’s approval before starting later phases.
- Ensure changes are bulletproof: add or update tests, include monitoring hooks when relevant, and document follow-up steps.

## Testing & Quality

- Jest + Testing Library live under `src/**/__tests__` and `*.test.ts(x)`; keep global coverage thresholds passing (see `jest.config.js`).
- Cover new behavior with automated tests (unit, integration, or E2E as appropriate) and add regression tests for bug fixes.
- When automation isn’t enough, record manual verification steps so results are reproducible (see `docs/manual-testing/tests/*.json`).

## Security

- Enforce secure defaults: validate inputs, sanitize outputs, and keep secrets in env-managed stores only.
- Run dependency and configuration audits regularly; patch critical vulnerabilities immediately.

## Code Review

- No self-merges: obtain peer review or explicit approval before merging.
- Ensure reviewers confirm test coverage, documentation updates, and rollback/mitigation plans.

## Observability

- Maintain or improve logging, metrics, and alerting whenever production pathways change.
- Prefer `trackEvent()` (`src/lib/telemetry.ts`) for key UX flows; avoid logging PII (emails are redacted in `src/lib/authTelemetry.ts`).
- Keep dashboards and monitors aligned with new or modified functionality.

## Accessibility & UX

- Meet accessibility standards (contrast, keyboard navigation, ARIA) for every UI change.
- Preserve consistent UX patterns and validate responsive behavior across breakpoints.
- Follow `docs/design-system/README.md` before introducing new UI primitives or interaction patterns.
- Mobile density: `src/index.css` enforces larger touch targets on `@media (pointer: coarse)`; use `touchTarget="compact"` (or `data-touch-target="compact"` / `.touch-target-compact`) for dense/icon/inline controls to avoid oversized buttons on mobile.

## Documentation & Releases

- Update READMEs, runbooks, and API docs alongside functional changes.
- Append changelog or release notes entries summarizing impact and rollout considerations.

## Dependencies

- Follow a regular cadence for dependency upgrades (e.g., monthly) and fast-track security patches.
- Document notable dependency shifts and verify compatibility in CI before merging.

## Performance

- Respect established budgets for latency, throughput, bundle size, and memory usage.
- Measure and document performance impacts for critical paths, with rollback plans if targets slip.

## Rollout Strategy

- Prefer feature flags or staged rollouts for risky or user-facing changes; define kill-switch procedures.
- Schedule and track cleanup of temporary flags or scaffolding to avoid lingering debt.
