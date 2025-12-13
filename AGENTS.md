# Codex Rules

Always review these before making any changes.

## Task Completion

- At the end of every task that alters the repository, reply with a single-line commit message summarizing the change.

## Guiding Principles

- Favor reusable components and clean abstractions; avoid one-off hacks or hardcoded logic.
- Keep the codebase DRY—refactor or consolidate duplication whenever practical.
- Solve issues at the root cause; no temporary workarounds or avoidable tech debt.
- Aim for production quality: scalable, reliable, stable, and future-proof solutions.
- Deliver professional polish without over-engineering; simple is best.
- Respect i18n: never hardcode user-facing strings; update all existing locales (EN and TR) when copy changes.

## Supabase Functions

- Any change under `supabase/functions/**` (shared helpers and templates included) must be deployed after merge.
- Before deploying, confirm Supabase CLI is authenticated and linked: `npx supabase login`, `npx supabase link --project-ref rifdykpdubrowzbylffe`.

## Process Expectations

- For multi-phase work, propose the plan and wait for Tayte’s approval before starting later phases.
- Ensure changes are bulletproof: add or update tests, include monitoring hooks when relevant, and document follow-up steps.

## Testing & Quality

- Cover new behavior with automated tests (unit, integration, or E2E as appropriate) and add regression tests for bug fixes.
- When automation isn’t enough, record manual verification steps so results are reproducible.

## Security

- Enforce secure defaults: validate inputs, sanitize outputs, and keep secrets in env-managed stores only.
- Run dependency and configuration audits regularly; patch critical vulnerabilities immediately.

## Code Review

- No self-merges: obtain peer review or explicit approval before merging.
- Ensure reviewers confirm test coverage, documentation updates, and rollback/mitigation plans.

## Observability

- Maintain or improve logging, metrics, and alerting whenever production pathways change.
- Keep dashboards and monitors aligned with new or modified functionality.

## Accessibility & UX

- Meet accessibility standards (contrast, keyboard navigation, ARIA) for every UI change.
- Preserve consistent UX patterns and validate responsive behavior across breakpoints.

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
