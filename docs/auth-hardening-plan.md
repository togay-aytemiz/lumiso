# Authentication & Recovery Hardening Plan

## Context
- The primary auth surface lives in `src/pages/Auth.tsx:1` and currently mixes sign-in, sign-up, password reset request, and recovery update flows in a single component.
- A `useEffect` redirect at `src/pages/Auth.tsx:56` immediately sends any authenticated user to `/`, which means Supabase password-recovery links open the dashboard instead of the reset form.
- Password reset requests call `supabase.auth.resetPasswordForEmail` with `redirectTo=${origin}/auth?type=recovery` at `src/pages/Auth.tsx:175`, so the right page loads but is bypassed by the redirect noted above.
- The codebase already has solid component tests for the happy-path flows (`src/pages/__tests__/Auth.test.tsx:41`), but there is no coverage for the “authenticated user hitting `/auth?type=recovery`” regression.
- Supabase currently owns all auth-related emails. Those templates use the default Supabase branding, while the product already ships Resend-powered transactional emails in `supabase/functions/send-template-email/index.ts`.
- `.codex/rules.md` requires production-quality delivery (tests, i18n, documentation), so this plan treats them as non-negotiable guardrails.

## Objectives
- Deliver a “rock solid” auth stack covering sign-in, sign-up, password recovery, password change, and Google sign-in.
- Ensure new-password flows force users to set a password before entering the app, while still logging them in automatically afterwards.
- Replace Supabase stock emails with Lumiso-branded templates for sign-up confirmation, password recovery, and password-changed notifications.
- Preserve or improve UX polish across all auth screens (responsive layout, accessibility, clear messaging).
- Extend automated and manual test coverage for every user journey touched by these changes.

## Guardrails & Standards (from `.codex/rules.md`)
- Update EN + TR locales for every new or changed copy; no hardcoded text.
- Cover new logic with automated tests (Jest for `src/**`, Deno tests for Supabase functions).
- Treat Supabase functions as deploy-required artifacts (`npx supabase login` + `npx supabase link --project-ref rifdykpdubrowzbylffe` before rollout).
- Ship with production-ready error handling, logging, and documentation updates.

## Status Snapshot — What Works Today

### Core Authentication
- [x] Email/password sign-in succeeds via `supabase.auth.signInWithPassword` (see `src/pages/Auth.tsx:145`), but lacks granular error surfacing (rate limiting, network failures) and telemetry.
- [x] Email/password sign-up creates accounts (`src/pages/Auth.tsx:110`) and respects Supabase confirmation, yet uses stock Supabase emails and default redirect to `/`.
- [ ] Google (or any OAuth) sign-in is absent in the UI and Supabase configuration.
- [x] Sign-out is available through `AuthContext` (`src/contexts/AuthContext.tsx:42`) and clears storage.

### Recovery & Password Management
- [x] Users can request a reset email (`src/pages/Auth.tsx:165`) and receive Supabase’s default template.
- [ ] Recovery links open `/auth?type=recovery` but immediately redirect to `/` because of the redirect effect at `src/pages/Auth.tsx:56`.
- [ ] There is no in-product “Change password” flow; settings currently rely on a password delete confirmation only (`src/pages/settings/DangerZone.tsx:1`).
- [ ] No notification/email is sent after a password update, so users lack confirmation or alerts for unexpected changes.

### Communications & Instrumentation
- [ ] Auth emails are unbranded (Supabase default).
- [ ] No analytics/telemetry is emitted for auth attempts, password reset starts/completions, or social sign-ins.
- [x] Existing Jest tests validate basic sign-in/sign-up/reset flows (`src/pages/__tests__/Auth.test.tsx:41`), but new edge cases (active session recovery, Google button) are uncovered.

## Key Pain Points
- Recovery emails log users straight into the dashboard, bypassing the new-password mandate.
- End-to-end experience lacks Lumiso flavor and clarity (emails, empty/error states, password strength guidance after recovery).
- Google sign-in is a business requirement but not implemented.
- Support has no observability into auth failures, and the team lacks a playbook for regression testing across these flows.

## Roadmap

### Phase 0 — Baseline Audit & Instrumentation
- Add temporary logging/telemetry hooks around auth events (Supabase responses, toasts) to understand failure modes before changes.
- Document current Supabase auth settings (redirect URLs, provider configuration, SMTP) and confirm environments (dev/staging/prod) match expectations.
- Deliverables: short audit log in this doc, checklist of Supabase dashboard settings, decision on telemetry destination (PostHog, Sentry breadcrumbs, etc.).

### Phase 1 — Password Recovery Hardening
1. **Redirect Fix**  
   - Update the redirect effect in `src/pages/Auth.tsx` to respect `type=recovery` (and future `type=invite`) before navigating away.
   - Ensure `ProtectedRoute` (`src/components/ProtectedRoute.tsx:12`) allows authenticated users to stay on `/auth` when `type=recovery` is present.
2. **Explicit Recovery State**  
   - Prefer a dedicated route (`/auth/recovery`) with state derived from URL params, avoiding hash parsing quirks.
   - Persist recovery context (email address) and guard against expired/invalid tokens with clear messaging.
3. **Post-reset Auto-login**  
   - After `supabase.auth.updateUser` succeeds, keep the existing auto-login redirect to `/`, but only once a new password is set.
4. **Tests**  
   - Add Jest coverage to ensure authenticated recovery does not redirect prematurely and that invalid tokens surface toast errors.
5. **Manual QA**  
   - Run Supabase reset links end-to-end in staging, including expired link handling.

### Phase 2 — Change Password Entry Point
- Add a “Change password” action under Settings → Profile (`src/pages/settings/Profile.tsx`) that triggers `supabase.auth.resetPasswordForEmail` for the current user.
- Mirror the recovery UX (email with `redirectTo=/auth/recovery` + confirmation toast).
- Show contextual guidance about auto-login after completion and security tips.
- Tests: component test covering the new settings action, plus an integration-style test ensuring the Auth page handles return trips initiated from settings.

### Phase 3 — Google Sign-In
- Enable Google provider in Supabase, capture client ID/secret, and store them in environment variables (e.g., `VITE_SUPABASE_GOOGLE_CLIENT_ID` if needed).
- Add a Google button to the Auth UI that calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}` } })`.
- Handle callback query params (`error`, `error_description`) and display localized toasts.
- Tests: UI snapshot + interaction test ensuring the OAuth call is made, plus a mocked callback scenario verifying error handling.
- Manual QA: Validate across mobile/desktop, both fresh sign-up and existing accounts.

### Phase 4 — Email & Notification Overhaul
- Generate Supabase auth links using `supabase.auth.admin.generateLink` inside `supabase/functions/send-template-email/index.ts` (or a new dedicated function) so Resend sends branded emails.
- Create Lumiso-branded templates for:
  1. Sign-up confirmation (welcome + next steps).
  2. Password recovery (clear CTA + expiry copy).
  3. Password changed notification (security alert).
- Update the Auth UI copy to match the email tone and provide fallback instructions if the email is missing.
- Add Deno tests ensuring the new templates render expected HTML with mock data.

### Phase 5 — UX Polish & Accessibility
- Audit the Auth screen for keyboard navigation, focus states, and contrast (especially around the carousel and password strength meters).
- Provide localized inline validation/errors for sign-up and recovery (e.g., checklist for password strength during recovery as well as sign-up).
- Ensure responsive layouts behave on narrow/mobile widths and remove any layout shifts.
- Tests: storybook/visual regression (if available) or screenshot diff workflow; at minimum, expand Jest DOM assertions for focus management.

### Phase 6 — Observability & Support Playbook
- Emit structured analytics events (e.g., `auth_sign_in_start`, `auth_sign_in_success`, `auth_reset_start`, `auth_reset_complete`) with outcome + metadata (provider, error code).
- Log Supabase errors with contextual breadcrumbs for triage (Sentry or equivalent).
- Document manual recovery playbook for support: how to generate reset links, revoke sessions, and validate email delivery.

## Testing & QA Additions (extend `docs/unit-testing-plan.md`)
- **Unit/Component Tests**
  - Auth page recovery gating (authenticated session scenario).
  - Google sign-in button interactions.
  - Settings change-password trigger.
- **Supabase Function Tests**
  - Template rendering and link generation for each auth email (mocking Resend + Supabase admin client).
- **Integration / Manual**
  - Full recovery loop (request → email → reset → auto-login).
  - Google OAuth login on staging domain.
  - Password change triggered from settings.
- Update the unit testing tracker with new rows/owners once implementation begins.

## Manual QA Checklist (to repeat per environment)
- Sign in/out with valid credentials; verify session persistence after reload.
- Attempt sign in with invalid credentials; confirm error copy and no stuck loading state.
- Request password reset, follow email, confirm new-password requirement and success redirect.
- Use an expired/used recovery link; confirm friendly failure message.
- Trigger change password from settings; ensure email arrives and re-entry works.
- Complete Google sign-in for both new and existing users; confirm Supabase profiles are consistent.
- Verify localized copy (EN/TR) on every auth screen.

## Dependencies & Preparations
- Supabase dashboard access to configure Google provider and custom email templates.
- Resend API key with production sender domain configured (already used by other functions, confirm scope).
- Design assets for branded auth emails and any updated illustrations.
- Environment variable updates for OAuth credentials and email template IDs if needed.

## Open Questions
- Should the recovery redirect land on `/auth/recovery` or a dedicated password-reset route (e.g., `/reset-password`)? Decision impacts routing and bookmarks.
- Do we want to opportunistically offer passkeys or magic-link login once the UI is being reworked?
- Where should telemetry flow (existing analytics stack vs. new provider)?

## Tracking & Next Steps
- This document supersedes `docs/password-recovery-todo.md`; keep progress updates here.
- After each implementation PR, append an iteration note (similar to `docs/session-types-plan.md`) covering what shipped, test evidence, and any follow-ups.
