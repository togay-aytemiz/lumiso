# Settings Experience Refresh Plan

## Context
- Feedback highlights oversized typography, uneven spacing, and a “prototype” feel across settings pages (`Profile`, `General`, `Notifications`, `Leads`, `Projects`, `Services`, `Billing`, `Contracts`, `DangerZone`).
- Layout primitives (`SettingsHeader`, `CategorySettingsSection`, legacy `SettingsSection`, bespoke lists) have diverged, creating inconsistent section hierarchy, button placement, and help affordances.
- Page-level data hooks (e.g., `useOrganizationSettings`, `useProfile`, `useSessionTypes`) refetch eagerly and trigger auto-saves, increasing Supabase traffic and surprising users while editing.
- Settings modules double as onboarding surfaces (tutorial overlays, sticky footers) but lack shared tokens for spacing, typography, or breakpoint behavior.
- Goal: establish a reusable system that scales as new sub-pages (people/role management, automations) land, while keeping implementation traceable via a checklist-driven roadmap.

## Goals
- Unify page shells: consistent header stack (title, eyebrow/subtext, actions/help), responsive paddings, and max-width behavior.
- Deliver a mobile-first navigation model that feels like a native settings app: dedicated icon + text index screen, near-edge gutters on small viewports, and clear back navigation when drilling into subsections; pair with desktop sticky anchor navigation so dense pages stay scannable.
- Define reusable section patterns (form, table, drag-and-drop management, danger blocks) with tokens for spacing, typography, and action placement.
- Normalize interactivity: predictable save vs. auto-save models, sticky footer triggers, and keyboard/accessibility affordances.
- Reduce unnecessary data churn by introducing caching, fetch-on-focus policies, and background refresh hooks for low-churn settings.
- Deliver a living checklist per settings page and module so progress can be tracked and shared across the team.

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
├── Billing
│   ├── Tax & Billing Profile (organization defaults for KDV + invoice identity)
│   └── Payment Methods (future state / integrations)
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

### 1. Page Shell Standardization
- New `SettingsShell` wrapper combines `SettingsPageWrapper` padding logic with a configurable max-width (`1280px` target) and responsive gutter (24px mobile → 48px desktop).
- `SettingsHeader` upgrade:
  - Title size locked to `text-[22px]` mobile / `text-[28px]` desktop with consistent line-height to avoid the oversized “starter project” look.
  - Optional eyebrow label (e.g., “Account”) for grouping sub-pages.
  - Subtext constrained to `max-w-2xl`, with multiline spacing token.
  - Actions/help aligned to the top-right with consistent icon sizing; collapse into overflow menu below `sm`.
  - Mobile sub-pages surface a sticky top bar with chevron-back, page title, and optional contextual action; the header fades into a single-row layout when scrolling.
  - Fade-in micro transition for page change to keep UI calm.
- Sticky footer aligns to new grid (max width, shadow token) and surfaces last-saved timestamp.

### 2. Section Patterns & Tokens
- Introduce `settingsTokens.ts` (spacing, typography, border radius, shadow, section gap).
 - Add `SettingsAnchorNav` variant (same interaction/rhythm as the sticky anchors already shipping on Project Details, Lead Details, and Sheet Details) that pins under the header on desktop, highlights active subsection, and exposes jump links; collapse into the mobile index/back pattern below `md`.
- Define section templates:
  1. **Form Card** (`SettingsFormSection`): label grid, description slot, default vertical spacing `space-y-5`, standard Save/Cancel hooks.
  2. **Collection Manager** (`SettingsCollectionSection`): header + table/list region with drag handles, add button inline; supports optional metrics footer.
  3. **Toggle Panel** (`SettingsToggleSection`): compact rows with icon, description, trailing toggle/test controls; responsive stack rules.
  4. **Danger Block**: red-accented variant with icon slot, bullet list, confirm button anchored bottom-right.
  5. **Placeholder / Coming Soon**: empty state card shared by `Billing`/`Contracts`.
- Unify typography tokens (e.g., section title `text-lg font-semibold`, description `text-sm text-muted-foreground`).
- Provide class utilities (via `cva` or helper) to guarantee consistent padding across breakpoints.

### 3. Data & Interaction Strategy
- **Fetch cadence**: set `react-query` options (`staleTime`, `refetchOnWindowFocus: false`), and add manual refresh CTA per page (via `SettingsHeader` action slot).
- **Edit flows**: adopt explicit save for multi-field sections, auto-save only for idempotent toggles with optimistic UI. Document behavior per section in checklist.
- **Dirty state**: replace pulse dot with pill badge (“Unsaved changes”) and highlight section border to increase visibility.
- **Asset uploads**: extract shared uploader hook (validation, optimistic preview, cleanup) for profile photo & logo.
- **Tutorial overlays**: encapsulate onboarding triggers with new `useSettingsTutorial` hook so visuals stay consistent with refreshed layout.
- **Analytics**: add instrumentation plan (event names: `settings_section_viewed`, `settings_save_submitted`, `settings_help_opened`).

### 4. Accessibility & Responsiveness
- Ensure keyboard navigation order (header actions → sections top-to-bottom) and focus outlines align with tokens.
- Provide reduced-motion variant for transitions (respect `prefers-reduced-motion`).
- Guarantee drag-and-drop sections expose reorder options for keyboard users (fallback move buttons).
- Audit color contrast of backgrounds/borders vs. text (target WCAG AA).
- Mobile breakpoint game plan:
  - `/settings` routes to a dedicated `SettingsMobileDashboard` with categorized cards (icon + label + chevron) and compact gutters (12–16px) to maximize usable space.
  - Sub-pages reuse the dashboard categories for breadcrumb context and always expose a top-left back arrow.
  - Forms tighten vertical rhythm (`space-y-4` default) and align actions to the screen edge so the view feels native-app compact.
  - Borrow sizing cues from modern OS settings (24px icons, 56px row height target) so the catalog reads familiar.
- Tablet/desktop breakpoint plan:
  - Keep existing two-column affordances where present but pin the new anchor nav under the header.
  - Maintain 48px outer gutters while allowing sticky nav to lock at 24px from the left content edge.

### 5. Content & Localization
- Update `settingsHelpContent` to match new structure; trim marketing fluff, align with actual functionality.
- Sync EN/TR translations for new copy; provide glossary for repeated terms (e.g., “Section”, “Digest”).
- Document microcopy tone: declarative, concise, professional (avoid exclamation unless destructive).

### 6. Empty State Illustrations
- Audit every settings empty state (including placeholders, zero-result lists, and onboarding cards) to inventory where visuals are missing or low-fidelity.
- Partner with the brand/illustration team to source a cohesive illustration set that reflects Lumiso’s tone; document whether we standardize on static SVGs, animated Lottie, or both.
- Deliver assets in light/dark variants and multiple sizes, stored under `src/assets/settings/empty-states`, with alt text guidance baked into component props.
- Extend `SettingsPlaceholderSection` to accept illustration options, caption slots, and CTA placements so empty states feel intentional and professional.
- Define usage rules (when to show, how copy pairs with art, fallback when assets fail to load) to keep the experience polished across future pages.

## Implementation Roadmap

### Phase 0 — Audit & Design Foundations
- [ ] Screenshot and measure current layouts (desktop/tablet/mobile) for each page.
- [ ] Map existing mobile navigation journeys (horizontal icon bar, nested routes) and note breakpoints where the experience breaks down.
- [ ] Define typography & spacing tokens (`settingsTokens.ts`, Figma tokens if available).
- [ ] Align with brand guidelines (confirm color palette & radius scale).
- Deliverables: token spec, audit notes, before-state assets archived in `/docs/assets/settings/`.

### Phase 1 — Core Components & Utilities
- [ ] Build `SettingsShell` + upgraded `SettingsHeader`.
 - [ ] Create `SettingsMobileDashboard`, `SettingsSubpageHeader`, and `SettingsAnchorNav` primitives with storybook examples, reusing the scroll-spy + sticky behaviors proven in Project/Lead/Sheet detail pages.
- [ ] Introduce section primitives (`SettingsFormSection`, `SettingsCollectionSection`, `SettingsToggleSection`, `SettingsDangerSection`, `SettingsPlaceholderSection`).
- [ ] Create shared uploader hook and refresh button pattern.
- [ ] Add storybook/preview entries (optional) or Chromatic snapshots.
- [ ] Update tests for new primitives (`src/components/settings/__tests__`).

### Phase 2 — Page Wave A (Foundation)
- `[ ]` Profile: migrate to new sections, refine avatar/work hours layout, hook to shared uploader.
- `[ ]` General: apply form + collection sections, add explicit save for branding/regional, unify social channels card, and wire anchor nav jump links per section.
- `[ ]` Billing › Tax & Billing Profile: design the KDV + invoice identity form using `SettingsFormSection`, surface organization defaults (legal entity, company name, tax office, VKN/TCKN, billing address, default KDV mode + rate, e-Fatura readiness toggle), and provide inline helper text explaining how values cascade into services/packages and future invoicing.
- `[ ]` Notifications: convert toggles to `SettingsToggleSection`, throttle fetches, add `Test` button alignment.
- `[ ]` Ship translation updates and ensure tutorials overlay the refreshed layout.
- `[ ]` Routing & breakpoints: route `/settings` to the mobile dashboard below `md`, ensure back navigation + compact spacing tokens apply across Profile/General/Notifications.

### Phase 3 — Page Wave B (Data Collections)
- `[ ]` Leads: refactor statuses & fields into collection sections, add keyboard reorder, align modals.
- `[ ]` Projects: same pattern as leads; ensure statuses/types share components.
- `[ ]` Services: standardize cards for session types/packages/services; consolidate onboarding surfaces.
- `[ ]` Document data fetch policies (manual refresh vs. auto).
- `[ ]` Extend anchor nav mapping and mobile back pattern to collection-heavy pages (Leads/Projects/Services) with sensible section groupings.

### Phase 3.5 — Compliance & Billing Foundations
- `[ ]` Persist organization tax profile via `useOrganizationSettings` with optimistic save + dirty state pill; ensure partial updates do not clear existing tax identifiers.
- `[ ]` Add validation masks for TCKN/VKN (11-digit national ID vs 10-digit tax number) and guard rails for numeric KDV ranges (0–99.99%).
- `[ ]` Surface audit log events (`settings_tax_profile_updated`) so finance tooling can track changes before e-Fatura integrations.
- `[ ]` Store structured invoice address (`street`, `district`, `city`, `country`, `postalCode`) ready for electronic invoice payloads.
- `[ ]` Document API contracts for downstream billing services (e.g., `POST /billing/profile/snapshot`) and expose a "Download billing profile" action for manual compliance exports.

### Phase 4 — Peripheral Pages & Cleanup
- `[ ]` Danger Zone: apply danger block pattern, tighten copy, confirm double-confirm flow.
- `[ ]` Billing & Contracts: replace placeholder paragraphs with reusable empty-state card.
- `[ ]` Remove deprecated components (`SettingsSection`, `EnhancedSettingsSection`) once unused.
- `[ ]` Update `SettingsPageWrapper` sticky footer visuals.
- `[ ]` Ensure analytics + logging in place.

### Phase 5 — QA, Performance, and Rollout
- [ ] Cross-browser testing (Chrome, Safari, Firefox) desktop/tablet/mobile.
- [ ] Usability pass with sample users (record feedback on density & clarity).
- [ ] Measure Supabase call volume pre/post refactor.
- [ ] Prepare migration notes + update this document with progress and learnings.
- [ ] Align release messaging and changelog.

## Page-by-Page Checklist
| Page | Section(s) | UI Refresh | Interaction Model | Data Strategy | Status | Product Team Questions |
| --- | --- | --- | --- | --- | --- | --- |
| Profile | Profile Info / Working Hours | [ ] | Define save vs. auto-save, tutorial overlay | Cache profile + working hours, manual refresh | Not Started | Should organization admins be allowed to change staff working hours directly, or must owners confirm adjustments? |
| General | Branding / Social / Regional | [ ] | Explicit save w/ footer + inline upload | Cached, refetch on demand | Not Started | Do we enforce brand color/logo constraints aligned with marketing guidelines or permit unrestricted customization? |
| Notifications | Master / Scheduled / Immediate | [ ] | Auto-save toggles + manual test triggers | Batch updates, debounce Supabase writes | Not Started | Which notification channels (email, SMS, push) need to be represented at launch and what delivery windows are promised? |
| Leads | Statuses / Fields | [ ] | Drag reorder + dialog pattern | Normalize queries, reduce background polling | Not Started | What default pipeline stages must every workspace retain, and can teams delete core stages? |
| Projects | Statuses / Types / Session Statuses | [ ] | Drag reorder + inline defaults | Shared hook for status entities | Not Started | Do project status/type templates need to stay synced across teams or can users diverge freely? |
| Services | Session Types / Packages / Services | [ ] | Multi-step onboarding alignment | Consolidate queries, lazy-load heavy dialogs | Not Started | Are packages expected to support multi-currency pricing in this release or remain single-currency? |
| Contracts | Placeholder | [ ] | N/A (display card) | Static copy | Not Started | Should the placeholder point to upcoming in-product templates or route to external contract resources until builder ships? |
| Billing | Tax & Billing Profile / Payment Methods | [ ] | Explicit save with helper modals + audit log surface | Persist `taxProfile` jsonb, prepare payment method vault stub | Not Started | Which e-Fatura provider (if any) are we targeting first, and do we need multi-address support for branches? |
| Danger Zone | Delete org | [ ] | Double confirm + password field | No auto-refetch | Not Started | Does org deletion require a grace period or approval workflow beyond the password confirmation flow? |

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
- (Populate when work begins; include date, owner, summary, tests run.)
