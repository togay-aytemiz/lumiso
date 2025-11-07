# Settings Experience Refresh Plan

## Context

- Feedback highlights oversized typography, uneven spacing, and a “prototype” feel across settings pages (`Profile`, `General`, `Notifications`, `Leads`, `Projects`, `Services`, `Billing`, `Contracts`, `DangerZone`).
- Layout primitives (`SettingsHeader`, `CategorySettingsSection`, legacy `SettingsSection`, bespoke lists) have diverged, creating inconsistent section hierarchy, button placement, and help affordances.
- Page-level data hooks (e.g., `useOrganizationSettings`, `useProfile`, `useSessionTypes`) refetch eagerly and trigger auto-saves, increasing Supabase traffic and surprising users while editing.
- Settings modules double as onboarding surfaces (tutorial overlays, sticky footers) but lack shared tokens for spacing, typography, or breakpoint behavior.
- Goal: establish a reusable system that scales as new sub-pages (people/role management, automations) land, while keeping implementation traceable via a checklist-driven roadmap.

## Goals

- Unify page shells: consistent header stack (title, eyebrow/subtext, actions/help), responsive paddings, and max-width behavior.
- Introduce a token-driven modal overlay shell that preserves the underlying page, with compact left-rail navigation and sticky anchor pills under the header.
- Deliver a mobile-first navigation model that feels like a native settings app: dedicated icon + text index screen, near-edge gutters on small viewports, and clear back navigation when drilling into subsections; pair with desktop sticky anchor navigation so dense pages stay scannable.
- Define reusable section patterns (form, table, drag-and-drop management, danger blocks) with tokens for spacing, typography, and action placement.
- Normalize interactivity: predictable save vs. auto-save models, sticky footer triggers, and keyboard/accessibility affordances.
- Lock typography, spacing, and control sizing to a “compact” token set so the refreshed UI reads small-but-neat compared with today’s spacious cards.
- Reduce unnecessary data churn by introducing caching, fetch-on-focus policies, and background refresh hooks for low-churn settings.
- Deliver a living checklist per settings page and module so progress can be tracked and shared across the team.
- Ship the refreshed experience behind a dedicated feature flag (`settings_modal_overlay_v1`) so we can toggle it safely until the rollout is final.

## Testing Constraints

- Automated settings suites (Jest / Playwright) are currently stalled. **Do not run `npm test`, `npx jest`, or related settings test commands during development.** Use the manual coverage in `docs/manual-testing/tests/settings-manual-tests.json` until the harness is repaired.

## Non-Goals

- Replacing the underlying settings navigation structure or routing.
- Introducing brand-new feature areas (e.g., subscription upgrades, granular permissions) beyond visual/UX refinements.
- Rewriting Supabase schemas for settings entities (handled separately when needed).

## Information Architecture Inventory

```
Settings (src/pages/settings)
├── Profile
│   ├── Profile Info (avatar, name, phone)
│   └── Working Hours (per-day schedule)
├── General
│   ├── Branding (business identity, contact, logo upload)
│   ├── Social Channels (link manager component)
│   └── Regional Preferences (date/time format, timezone, language)
├── Notifications
│   ├── Master Controls (global toggle, scheduled time)
│   ├── Scheduled Digest (daily summary, follow-up reminders)
│   └── Immediate Alerts (lead, project, payment toggles)
├── Leads
│   ├── Lead Statuses (drag-and-drop pipeline)
│   └── Lead Fields (capture form builder + dialogs)
├── Projects
│   ├── Project Statuses (drag-and-drop)
│   ├── Project Types (tag manager)
│   └── Session Statuses (status list)
├── Services
│   ├── Session Types (list + default selector)
│   ├── Packages (pricing cards + onboarding tutorial)
│   └── Services Catalog (category cards)
├── Contracts (placeholder copy)
├── Billing (Client-Facing)
│   ├── Tax & Billing Profile (organization defaults for KDV + invoice identity used when issuing client invoices / packages)
│   └── Payment Methods (future state / integrations that underpin invoicing + package pipelines)
├── Billing (Subscription / Lumiso ↔︎ Customer)
│   └── TBD — product spec in progress; holds workspace’s Lumiso subscription, invoices, and usage metrics (kept separate from client billing so data + permissions do not collide)
└── Danger Zone (destructive actions, password confirmation)

Cross-cutting components:
├── SettingsPageWrapper (+ sticky footer)
├── SettingsHeader / SettingsHelpButton
├── Section primitives: CategorySettingsSection, SettingsSection, EnhancedSettingsSection
└── Dialog suites: lead/service/project/package/session status management
```

## Pain Points & Risks

- **Visual consistency**: headings range from `text-xl` to `text-3xl`, card paddings fluctuate (`p-4`, `p-6`, `border-2`), and action buttons jump between inline and stacked layouts.
- **Information density**: large cards with generous whitespace push key controls below the fold, especially on laptops; drag-and-drop lists stretch full width instead of aligning to a grid.
- **Mobile UX gap**: horizontal icon-only navigation hides labels, consumes vertical space, and lacks an in-page back control; wide gutters make forms feel zoomed-out instead of app-native.
- **Interaction friction**: some sections auto-save on toggle, others rely on the sticky footer; the state of dirty forms is not always evident (small pulse indicator).
- **Technical churn**: frequent refetches (every section change triggers `useQuery` invalidations), and uploads (logo, avatar) duplicate logic across sections.
- **Content maintenance**: help drawer strings are generic/duplicated; translations vary in tone between pages; no centralized tokens for spacing or typography.

## Proposed System

### 1. Modal Shell Standardization

- Replace the page-level canvas with a feature-flagged `SettingsModalShell` that opens as a lightweight overlay, dimming but not hiding the underlying page so users keep spatial context.
  - Shell sits on top of the app with `backdrop-blur-sm` + 16% scrim, matches the “Lovable” modal vibe, and keeps a 48px margin from viewport edges on desktop while using full bleed on mobile.
  - Left rail lives inside the modal (140px target width) with compact icon + label pills inspired by the reference designs; it remembers the last active category per workspace.
  - Sticky anchor pills render directly under the modal header, highlighting the active subsection and offering quick jumps without scrolling the rail.
  - Escape, header close button, and outside click respect dirty-state guard logic (see §3).
  - Motion tokens live in `src/index.css` (`.settings-overlay-enter`, `.settings-modal-enter`, `.settings-header-motion`, `.settings-content-motion`) to keep open/close and nav transitions consistent.
- `SettingsHeader` upgrades now rely on explicit tokens:
  - `token('settings.header.title')` → `text-[22px]` mobile / `text-[26px]` desktop, tightened line-height, letter-spacing `-0.01em`.
  - `token('settings.header.description')` → `text-sm`, `max-w-xl`, neutral-600 color for compact copy blocks.
  - Eyebrow (`token('settings.header.eyebrow')`) and action tokens define casing, weight, and spacing so every modal carries the same hierarchy.
  - Actions/help align to the top-right, collapse into a kebab + icon tray under `sm`, and include a dedicated `Need help?` slot for the Lovable-inspired walkthrough sheet.
  - Mobile sub-pages pull the same header tokens into a sticky top bar (back chevron + title) and fade to a single row during scroll.
- Sticky footer sticks to the modal’s content column, inherits the compact spacing tokens (`token('settings.footer.padding')` = 16px), shows last-saved timestamp, and broadcasts guard events when users attempt to dismiss with unsaved changes.

### 2. Section Patterns & Tokens

- Introduce `settingsTokens.ts` (spacing, typography, border radius, shadow, section gap) with explicit exports for header, description, eyebrow, footer, pill, and rail tokens so “compact” sizing stays traceable.
- ✅ `settingsTokens.section.*` now captures padding, grid, and spacing primitives while `.settings-section-*` utilities in `src/index.css` lock the surface, shadow, and typography for content blocks.
- ✅ `SettingsTwoColumnSection` and `SettingsSingleColumnSection` (see `src/components/settings/SettingsSections.tsx`) provide the dedicated left-rail/form and full-width table scaffolds with baked-in action slots, dirty indicators, and anchor metadata.
- Lock reusable section surfaces to a borderless white card (`bg-white`) with `rounded-lg` corners (desktop `rounded-xl`), soft ambient shadow (`shadow-[0_12px_28px_-18px_rgba(15,23,42,0.55)]`), and tighter padding defaults (20px mobile / 24px desktop). Document matching dark mode token (`bg-slate-950/60`, subtle border) for parity.
- Add a `useSettingsAnchorRegistry` hook that each `CategorySettingsSection` consumes to register its scroll target, dirty-state setter, and metadata; anchors drive the sticky pills, fired events, and analytics breadcrumbs.
- Add `SettingsAnchorNav` variant (same interaction/rhythm as the sticky anchors already shipping on Project Details, Lead Details, and Sheet Details) that pins under the header on desktop, highlights active subsection, and exposes jump links; collapse into the mobile index/back pattern below `md`. The nav uses `token('settings.anchor.pill')` for padding, radius, and font weight so it remains compact and readable.
- Define section templates:
  1. **Form Card** (`SettingsFormSection`): label grid, description slot, default vertical spacing `space-y-4`, standard Save/Cancel hooks; opts into the new elevated card surface.
  2. **Collection Manager** (`SettingsCollectionSection`): header + table/list region with drag handles, add button inline; supports optional metrics footer; caps list regions to avoid edge-to-edge sprawl with consistent outer gutters.
  3. **Toggle Panel** (`SettingsToggleSection`): compact rows with icon, description, trailing toggle/test controls; responsive stack rules keep row height around 56px.
  4. **Danger Block**: red-accented variant with icon slot, bullet list, confirm button anchored bottom-right.
  5. **Placeholder / Coming Soon**: empty state card shared by `Billing`/`Contracts`.
- Unify typography tokens (e.g., section title `text-lg font-semibold`, description `text-sm text-muted-foreground`).
- Provide class utilities (via `cva` or helper) to guarantee consistent padding across breakpoints while capping max spacing tokens to avoid oversized gutters.

### 3. Data & Interaction Strategy

- **Fetch cadence**: set `react-query` options (`staleTime`, `refetchOnWindowFocus: false`), and add manual refresh CTA per page (via `SettingsHeader` action slot).
- **Edit flows**: adopt explicit save for multi-field sections, auto-save only for idempotent toggles with optimistic UI. Document behavior per section in checklist and surface save CTA in the sticky footer + anchor pill when dirty.
- **Dirty state**: replace pulse dot with pill badge (“Unsaved changes”) and add a soft brand-accent glow/top stripe so the borderless card still signals state. Dirty sections automatically register with `useSettingsAnchorRegistry`, ensuring pills show an inline “•” badge and the footer aggregates fields.
- **Guard rails**: introduce `useSettingsDirtyGuard` to intercept modal dismiss, route changes, and command palette navigation. Guard triggers a compact confirm dialog (`Stay / Discard`) and emits `settings:dirty-escape-attempt` analytics.
- **Events & timestamps**: sticky footer broadcasts `settings:save-started|succeeded|failed` events with section ids so selective refreshers can patch local caches. Footer surfaces “Saved 2 min ago” using `token('settings.footer.timestamp')` typography.
- **Asset uploads**: extract shared uploader hook (validation, optimistic preview, cleanup) for profile photo & logo.
- **Tutorial overlays**: encapsulate onboarding triggers with new `useSettingsTutorial` hook so visuals stay consistent with refreshed layout.
- **Analytics**: add instrumentation plan (event names: `settings_section_viewed`, `settings_save_submitted`, `settings_help_opened`).

### 4. Billing Alignment

- We now treat billing as **two parallel surfaces**:

  - `Client Billing` (today’s `TaxBillingSection`) powers outbound invoices, package creation, and any client-facing fiscal identity. This lives inside workspace settings and inherits the new section templates documented here.
  - `Lumiso Subscription Billing` governs how we charge the workspace owner (plans, receipts between Lumiso and the user). Product specs are still in-flight, so this doc only scopes the client-facing experience while reserving real estate for the second surface once requirements land.

- Rewrite `/settings/billing` using the modal shell + section primitives so it no longer ships bespoke buttons/badges.
- Gate the billing rewrite behind the same `settings_modal_overlay_v1` flag; legacy page stays reachable until rollout is complete.
- Break the client-billing page into `Tax & Billing Profile` and `Payment Methods` sections, each registering anchors, dirty state, and save handlers via the shared hooks. Saved timestamps + events flow through the shared footer.
- Ensure helper modals (tax address edit, payment method removal) respect dirty guards, broadcast save events for selective refresh, and reuse the compact tokens so the experience stays consistent.

### 5. Accessibility & Responsiveness

- Ensure keyboard navigation order (header actions → sections top-to-bottom) and focus outlines align with tokens.
- Provide reduced-motion variant for transitions (respect `prefers-reduced-motion`).
- Guarantee drag-and-drop sections expose reorder options for keyboard users (fallback move buttons).
- Audit color contrast of backgrounds/borders vs. text (target WCAG AA).
- Mobile breakpoint game plan:
  - `/settings` routes to a dedicated `SettingsMobileDashboard` with categorized cards (icon + label + chevron) and compact gutters (12–16px) to maximize usable space.
  - Sub-pages reuse the dashboard categories for breadcrumb context and always expose a top-left back arrow.
  - Forms tighten vertical rhythm (`space-y-4` default) and align actions to the screen edge so the view feels native-app compact.
  - Borrow sizing cues from modern OS settings (24px icons, 56px row height target) so the catalog reads familiar.
  - ✅ Implemented dashboard/back navigation in code, including lock/dirty indicators and shared guard handling on mobile.
  - ✅ Converted the mobile experience to a full-screen page (no modal chrome) with accent-forward list tiles that route through the shared navigation guard.
- Tablet/desktop breakpoint plan:
  - Keep existing two-column affordances where present but pin the new anchor nav under the header.
  - Maintain 48px outer gutters while allowing sticky nav to lock at 24px from the left content edge.

### 6. Content & Localization

- Update `settingsHelpContent` to drive the sheet component; trim marketing fluff, map to real troubleshooting steps, and define slots for embedded media callouts.
- Migrate `SettingsHelpSheet` strings into shared i18n namespaces (EN/TR first), including alt text and captions for videos/charts so localized help experiences stay in sync.
- Capture the new tax & billing defaults (VAT mode/rate, entity fields) in the same namespaces so UI copy, the new `TaxBillingSection`, and documentation stay synchronized.
- Document microcopy tone: declarative, concise, professional (avoid exclamation unless destructive).

### 7. Empty State Illustrations

- Audit every settings empty state (including placeholders, zero-result lists, and onboarding cards) to inventory where visuals are missing or low-fidelity.
- Partner with the brand/illustration team to source a cohesive illustration set that reflects Lumiso’s tone; document whether we standardize on static SVGs, animated Lottie, or both.
- Deliver assets in light/dark variants and multiple sizes, stored under `src/assets/settings/empty-states`, with alt text guidance baked into component props.
- Extend `SettingsPlaceholderSection` to accept illustration options, caption slots, and CTA placements so empty states feel intentional and professional.
- Define usage rules (when to show, how copy pairs with art, fallback when assets fail to load) to keep the experience polished across future pages.

## Implementation Roadmap

### Phase 0 — Audit & Design Foundations

- ▫️ Screenshot and measure current layouts (desktop/tablet/mobile) for each page.
- ▫️ Map existing mobile navigation journeys (horizontal icon bar, nested routes) and note breakpoints where the experience breaks down.
- ✅ Define typography & spacing tokens (`settingsTokens.ts`, Tailwind utilities in `src/index.css`).
- ▫️ Align with brand guidelines (confirm color palette & radius scale).
- ▫️ Partner with platform team to provision the `settings_modal_overlay_v1` feature flag, document rollout criteria, and ensure per-workspace toggling works in staging.
- Deliverables: token spec, audit notes, before-state assets archived in `/docs/assets/settings/`.

### Phase 1 — Core Components & Utilities

- ✅ Build `SettingsModalShell` + upgraded `SettingsHeader`.
- ✅ Wrap new shell/components in the `settings_modal_overlay_v1` feature flag with runtime switch + fallback to legacy layout.
- ✅ Implement desktop `SettingsAnchorNav` within the modal shell, including scroll-spy integration, DOM discovery for legacy sections, and consistent sticky behavior across Profile, General, Notifications, Projects, Leads, Services, and other pages.
- ✅ Ship mobile-first navigation baseline: `SettingsMobileDashboard` + in-modal subpage header/back affordance mirroring native settings apps, wired into existing navigation guard + scroll-spy logic.
- ✅ Route `/settings` index to the new settings directory rather than auto-routing to Profile, preserving desktop + mobile parity.
- ✅ Create `useSettingsAnchorRegistry` primitive (see `src/contexts/SettingsAnchorRegistryContext.tsx`) so sections can self-register anchors via `SettingsTwoColumnSection`/`SettingsSingleColumnSection`; layout now merges registry items with DOM discovery for sticky pills.
- ✅ Implement `SettingsHelpSheet` component triggered by the header `Need help?` action; support markdown + media embeds and connect content to the shared i18n pipeline.
- ✅ Introduce section primitives (`SettingsFormSection`, `SettingsCollectionSection`, `SettingsToggleSection`, `SettingsDangerSection`, `SettingsPlaceholderSection`) powered by `SettingsTwoColumnSection`/`SettingsSingleColumnSection` so teams can drop in consistent layouts without redoing scaffolding (`src/components/settings/SettingsSectionVariants.tsx`).
- ✅ Create shared uploader hook + refresh button pattern (`useSettingsFileUploader`, `SettingsRefreshButton`) and roll them into Profile + General so manual refresh/output affordances stay consistent.
- ▫️ Add storybook/preview entries (optional) or Chromatic snapshots.
- ▫️ **Skip this step** Update tests for new primitives (`src/components/settings/__tests__`).

### Phase 2 — Page Wave A (Foundation)

- ✅ Profile: migrate to new sections, refine avatar/work hours layout, hook to shared uploader.
- ✅ General: apply form + collection sections, add explicit save for branding/regional, unify social channels card, and wire anchor nav jump links per section.
- ✅ Notifications: convert toggles to `SettingsToggleSection`, throttle fetches, add `Test` button alignment.
  - ✅ Surface sticky anchor navigation pills by tagging existing sections without restructuring legacy components.
- ✅ Added `SettingsImageUploadCard` so Profile + General share the refreshed uploader affordance + tokens.
- ▫️ Ship translation updates and ensure tutorials overlay the refreshed layout.
- ▫️ Routing & breakpoints: route `/settings` to the mobile dashboard below `md`, ensure back navigation + compact spacing tokens apply across Profile/General/Notifications.
- ✅ Restored category-level dirty tracking so the sticky save footer and sidebar dirty indicators light up immediately when Profile/General edits occur, even inside the overlay shell.
- ✅ Mobile anchor chips now render on Profile/General/Notifications so the overlay nav matches desktop for form-heavy pages.

### Phase 3 — Page Wave B (Data Collections)

- ✅ Leads: refactor statuses & fields into collection sections, add keyboard reorder, align modals.
  - ✅ Annotated legacy sections so the refreshed sticky navigation renders across the page.
- ✅ Projects: same pattern as leads; ensure statuses/types share components and hook into the refreshed section primitives so anchor nav + dirty pills stay consistent.
  - ✅ Added anchor metadata to existing sections to participate in the sticky navigation.
  - ✅ Project types now live in the two-column shell shared by statuses/session stages so actions + helper copy feel consistent.
- ✅ Services: standardize cards for session types/packages/services; consolidate onboarding surfaces and actions with the compact collection shell.
  - ✅ Enabled sticky navigation by backfilling section anchors on current components.
  - ✅ Session type + package cards now render without the redundant inner wrapper so density matches the rest of the compact settings.
  - ✅ Package cards regain mobile padding so cards no longer touch the viewport edges.
- ✳️ **Data Fetch Policy Notes** — React-query caches all collection fetches per organization with `staleTime=5m`, window-focus revalidation disabled; every settings page exposes the `SettingsRefreshButton` so ops teams can pull a manual refresh (call to `refetch()` on the underlying hook). Mutations triggered by drag/drop or dialogs keep their existing optimistic updates + background refetch. Free-form inputs never auto-save: they rely on the sticky footer (ensuring explicit intent) while non-form toggles continue to auto-save with inline toast confirmations.
- ✅ Documented data fetch policies (manual refresh vs. auto): Leads/Projects/Services read from their `useOrganizationData` react-query caches (staleTime 5m) with a shared `SettingsRefreshButton` triggering `refetch()`; only mutation flows auto-save (drag/drop, dialog submits) while text inputs rely on the sticky footer so users explicitly commit batched edits.
- ✅ Extend anchor nav mapping and mobile back pattern to collection-heavy pages (Leads/Projects/Services) with sensible section groupings — sticky pills now appear on mobile detail views for these pages, mirroring the desktop nav and keeping the “Back to settings” affordance one tap away.

### Phase 3.5 — Compliance & Billing Foundations

- ✅ Persist organization tax profile via `useOrganizationSettings` with optimistic save + dirty-state pill; ensure partial updates do not clear existing tax identifiers.
- ✅ Validate the Supabase migration `20251109120000_services_vat_profile.sql` (service VAT columns + tax profile defaults) and document rollout sequencing. _(Applied to prod 2025‑11‑09.)_
- ✅ Billing tax profile now hooks into the shared sticky footer (no bespoke chip/buttons) so only input edits surface the save bar while other toggles keep toast-only auto-save behavior.
- ▫️ QA + deploy follow-up migration `20251109161000_tax_profile_defaults_include.sql` to align defaults with VAT-inclusive pricing and update seeded sample services.
- ▫️ Add validation masks for TCKN/VKN (11-digit national ID vs 10-digit tax number) and guard rails for numeric KDV ranges (0–99.99%).
- ▫️ Surface audit log events (`settings_tax_profile_updated`) so finance tooling can track changes before e-Fatura integrations.
- ▫️ Store structured invoice address (`street`, `district`, `city`, `country`, `postalCode`) ready for electronic invoice payloads.
- ▫️ Document API contracts for downstream billing services (e.g., `POST /billing/profile/snapshot`) and expose a "Download billing profile" action for manual compliance exports.
- ▫️ Finalize requirements for the separate Lumiso subscription billing surface (plans, receipts, upgrade/downgrade flows) to ensure it ships independently from client billing.

### Phase 4 — Peripheral Pages & Cleanup

- ▫️ Danger Zone: apply danger block pattern, tighten copy, confirm double-confirm flow.
- ▫️ Billing & Contracts: replace placeholder paragraphs with reusable empty-state card.
- ▫️ Remove deprecated components (`SettingsSection`, `EnhancedSettingsSection`) once unused.
- ✅ Update `SettingsPageWrapper` sticky footer visuals.
- ▫️ Ensure analytics + logging in place.

### Phase 5 — QA, Performance, and Rollout

- ▫️ Cross-browser testing (Chrome, Safari, Firefox) desktop/tablet/mobile.
- ▫️ Usability pass with sample users (record feedback on density & clarity).
- ▫️ Measure Supabase call volume pre/post refactor.
- ▫️ Prepare migration notes + update this document with progress and learnings.
- ▫️ Align release messaging and changelog.

## Page-by-Page Checklist

| Page                          | Section(s)                                        | UI Refresh | Interaction Model                                                | Data Strategy                                                                                  | Status      | Product Team Questions                                                                                                     |
| ----------------------------- | ------------------------------------------------- | ---------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Profile                       | Profile Info / Working Hours                      | ▫️         | Define save vs. auto-save, tutorial overlay                      | Cache profile + working hours, manual refresh                                                  | In Progress | Should organization admins be allowed to change staff working hours directly, or must owners confirm adjustments?          |
| General                       | Branding / Social / Regional                      | ▫️         | Explicit save w/ footer + inline upload                          | Cached, refetch on demand                                                                      | In Progress | Do we enforce brand color/logo constraints aligned with marketing guidelines or permit unrestricted customization?         |
| Notifications                 | Master / Scheduled / Immediate                    | ▫️         | Auto-save toggles + manual test triggers                         | Batch updates, debounce Supabase writes                                                        | In Progress | Which notification channels (email, SMS, push) need to be represented at launch and what delivery windows are promised?    |
| Leads                         | Statuses / Fields                                 | ▫️         | Drag reorder + dialog pattern                                    | Normalize queries, reduce background polling                                                   | Not Started | What default pipeline stages must every workspace retain, and can teams delete core stages?                                |
| Projects                      | Statuses / Types / Session Statuses               | ✅         | Drag reorder + inline defaults                                   | Shared hook for status entities                                                                | In Progress | Do project status/type templates need to stay synced across teams or can users diverge freely?                             |
| Services                      | Session Types / Packages / Services               | ✅         | Multi-step onboarding alignment                                  | Consolidate queries, lazy-load heavy dialogs                                                   | In Progress | Are packages expected to support multi-currency pricing in this release or remain single-currency?                         |
| Contracts                     | Placeholder                                       | ▫️         | N/A (display card)                                               | Static copy                                                                                    | Not Started | Should the placeholder point to upcoming in-product templates or route to external contract resources until builder ships? |
| Billing — Client              | Tax & Billing Profile / Payment Methods           | ▫️         | Modal overlay + shared sticky footer/guard dialog + anchor pills | Persist `taxProfile` jsonb, inclusive defaults cached; payment method vault stub still pending | In Progress | Which e-Fatura provider (if any) are we targeting first, and do we need multi-address support for branches?                |
| Billing — Lumiso Subscription | Subscription plan, invoices, payment method vault | ▫️         | TBD (spec in progress; likely standalone modal/section)          | Separate data model from client billing; needs Stripe/customer portal integration strategy     | Not Started | What telemetry + plan upgrades do we expose? Do we embed Stripe customer portal or build native UI?                        |
| Danger Zone                   | Delete org                                        | ▫️         | Double confirm + password field                                  | No auto-refetch                                                                                | Not Started | Does org deletion require a grace period or approval workflow beyond the password confirmation flow?                       |

> Update the table as work lands (check items, add Notes column if needed).

## Technical Follow-Ups

- Consolidate Supabase RPC usage: prefer centralized service modules under `src/services/settings/**`.
- Introduce API mocks for settings hooks to enable deterministic Jest tests.
- Evaluate background sync via Supabase realtime (opt-in) vs. scheduled refetch.
- Create visual regression snapshots for core pages (Playwright + percy-like tool).

## Testing & QA Strategy

- Unit: cover new section primitives, uploader hooks, and settings context state transitions.
- Integration: add Cypress/Playwright flows for Profile/General/Notifications save cycles.
- Visual: run Chromatic or Percy diff on key breakpoints.
- Performance: log bundle impact (target net-neutral) and measure paint timelines via Lighthouse.
- Accessibility: automated (axe) + manual keyboard review for drag-and-drop alternatives.

## Open Questions

- Should notifications adopt per-channel delivery (email, push) now or later? Impacts layout complexity.
- Do we need granular role-based visibility before redesign (e.g., per future team accounts)?
- Where should reusable iconography live (Lucide vs. custom set) to keep consistent sizing?

## Tracking & Iteration Log

- 2025-11-07 — Codex — Ported `/list` page to the refreshed shell/tokens so list management mirrors the new settings experience; manual smoke on desktop + mobile flows.
- 2025-11-07 — Codex — Phase 2 kickoff: shared `SettingsImageUploadCard` now powers Profile/General, and Notifications sections are tagged for the sticky nav/tutorials; manual checks on `/settings/profile`, `/settings/general`, `/settings/notifications`.
- 2025-11-07 — Codex — Projects + Services waves refit: statuses/types/session sections now ride the `SettingsCollectionSection`/`SettingsTwoColumnSection` shells with compact header actions, unblocked anchor pills, and refreshed package/service cards; manual skim on `/settings/projects` and `/settings/services`.
- 2025-11-08 — Codex — Project types adopted the two-column management layout and settings dirty-state tracking was stabilized so the sticky save footer + nav dots reappear on `/settings/projects`, `/settings/profile`, and `/settings/general`.
- 2025-11-08 — Codex — Removed the extra wrappers around session types/packages cards, fixed the input reset regression so Profile/General fields stay editable, and brought the tax & billing section onto the shared sticky footer flow.
- 2025-11-08 — Codex — Extended the anchor nav + mobile back pattern for `/settings/leads`, `/settings/projects`, and `/settings/services` so the chip navigation appears on mobile detail views just like desktop.
- 2025-11-08 — Codex — Added mobile anchor pills for Profile/General/Notifications and restored gutter padding around Packages cards.
