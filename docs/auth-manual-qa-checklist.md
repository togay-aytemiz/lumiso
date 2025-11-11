# Auth Manual QA Checklist

Use this checklist every time we touch the authentication stack. Record the environment, timestamp, and tester initials for each run. Update the “Status” column with `Pass`, `Fail`, or `Blocked`, and include notes (link to videos/logs where helpful).

## Metadata

| Field | Value |
| --- | --- |
| Build / Commit | _fill in before starting_ |
| Environment | _dev / staging / prod_ |
| Tester | _name + initials_ |
| Date | _YYYY-MM-DD_ |

## Core Sign-In / Sign-Up

| # | Scenario | Steps | Expected Result | Status / Notes |
| --- | --- | --- | --- | --- |
| 1 | Email/password sign-in (happy path) | Sign in with a confirmed account. Refresh dashboard. | Redirect to `/`, session persists on refresh, breadcrumb shows `auth_sign_in_success`. | Pending |
| 2 | Invalid credentials | Enter wrong password. | Toast shows localized error, no redirect, telemetry logs `auth_sign_in_error`. | Pending |
| 3 | New account sign-up | Create account via `/auth/signup`. | Confirmation toast, Resend email arrives, Supabase pending user flips to confirmed after clicking CTA. | Pending |

## Recovery & Password Management

| # | Scenario | Steps | Expected Result | Status / Notes |
| --- | --- | --- | --- | --- |
| 4 | Request password reset | From `/auth`, request reset email. | Toast success, Resend email received with branded copy, link points to `/auth/recovery?email=...`. | Pending |
| 5 | Recovery link with active session | While logged in, open recovery link. | Stays on `/auth/recovery`, no redirect to `/`, can reset password. | Pending |
| 6 | Expired or reused link | Use recovery link twice / wait >60 min. | Toast shows invalid-link copy, telemetry logs `auth_recovery_session_missing`. | Pending |
| 7 | Update password | Complete reset form. | Redirect to `/`, password-change confirmation email received, telemetry logs `auth_password_update_success`. | Pending |
| 8 | Settings → Change password | Click the security CTA in Profile settings. | Toast success, recovery email arrives, telemetry logs `auth_reset_request_start/success`. | Pending |

## Email Branding + Notifications

| # | Scenario | Steps | Expected Result | Status / Notes |
| --- | --- | --- | --- | --- |
| 9 | Sign-up confirmation email | Trigger sign-up and inspect message. | Branded Resend template, CTA opens `auth?mode=confirmed`, no Supabase stock email. | Pending |
| 10 | Password recovery email | Inspect latest recovery email. | Branded copy (EN/TR as appropriate), CTA opens generated link, headers include `X-Lumiso-Auth-Intent: password_recovery`. | Pending |
| 11 | Password-change notification | Complete reset and inspect notification. | Security email sent once, advises next steps, log entry in `notification_logs`. | Pending |

## Observability & Support Hooks

| # | Scenario | Steps | Expected Result | Status / Notes |
| --- | --- | --- | --- | --- |
| 12 | Breadcrumb buffer | In browser DevTools run `window.__lumisoAuthEvents`. | Shows last ~50 auth events with redacted payloads. | Pending |
| 13 | Support playbook commands | Dry run `send-template-email` invocations (sign-up + recovery) via CLI against dev env. | Commands succeed, Resend email delivered, instructions in doc validated. | Pending |

## Paused / Blocked

| Scenario | Notes |
| --- | --- |
| Google OAuth sign-in | Phase paused; keep test case blocked until feature resumes. |

> After completing the checklist, link this file in the PR description or release log and attach any relevant evidence (screenshots, PostHog charts, Sentry breadcrumbs). Update `docs/auth-hardening-plan.md` if new manual scenarios emerge.
