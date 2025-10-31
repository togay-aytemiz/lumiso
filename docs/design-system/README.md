# Lumiso Design System Notes

This document captures the current design primitives, shared patterns, and implementation guardrails that power the Lumiso UI. Treat it as a living reference—update it whenever we add new UI primitives or refine existing ones.

## 1. Foundations

### 1.1 Color Tokens
- Tailwind reads from CSS variables defined in `theme.extend.colors` (see `tailwind.config.ts`). Core tokens: `background`, `foreground`, `border`, `primary`, `secondary`, `accent`, `muted`, `destructive`, `card`, `popover`, and contextual `sidebar` colors.
- Status badges (`status-new`, `status-booked`, etc.) provide semantic pairs (`bg` + `text`). Prefer them whenever you display lifecycle information.
- Keep new brand shades scoped to CSS variables so dark mode and theming work automatically.

### 1.2 Typography & Spacing
- Primary font stack: `Inter` (`font-sans`).
- Default section spacing: `space-y-6` between blocks, `p-6` (desktop) / `p-4` (mobile) for page padding.
- Cards (`<Card>` / `SettingsSection`) use `rounded-lg`, `shadow-sm`, and `border` for consistency.

### 1.3 Radius & Elevation
- Global radius tokens (`--radius`) feed `rounded-md`, `rounded-lg`, etc. Avoid hard-coded pixel radii unless you have a one-off treatment.
- Elevation: `shadow-sm` for resting cards, `shadow-lg` for lift states (drag, hover over key cards).

### 1.4 Motion
- Core keyframes live in `tailwind.config.ts` (`accordion-*/slide-*`). Use the predefined classes (`animate-accordion-down`, `animate-slide-in-bottom`) instead of custom CSS when possible.
- Duration ranges: 150–250ms for small transitions, 300–400ms for full-sheet or modal entrances.

## 2. Layout Patterns

### 2.1 Settings Pages
- Each section should use `SettingsSection` (title, description, inline action). This ensures consistent padding, card styling, and responsive behavior.
- Sticky footers (where present) rely on `SettingsStickyFooter`—avoid bespoke footers to keep mobile ergonomics intact.

### 2.2 Page Header
- Use `PageHeader` + `PageHeaderSearch` to align titles, breadcrumbs, and global search in dashboards.
- Action buttons inside headers should be `Button` components (`size="sm"` on desktop, `w-full` on mobile when needed).

### 2.3 Cards & KPI Blocks
- `KpiCard` and examples in `docs/KpiCardExamples.md` define data card structure. Keep icons inside the provided slots (32px square by default) and use `density="compact"` when multiple KPIs sit side-by-side.

## 3. Interactive Components

### 3.1 Buttons
- Primary call-to-action: `<Button />` with `variant="default"`.
- Secondary actions: `variant="outline"` (bordered) or `variant="ghost"` (text-level). Reserve `variant="destructive"` for irreversible actions.

### 3.2 Icon Action Button / Group
- Use `IconActionButton` (`src/components/ui/icon-action-button.tsx`) for standalone icon controls.
- Variants: `default` (muted base, primary hover) and `danger` (red base + hover). Buttons are `h-9 w-9`, `rounded-md`, and include baked-in focus ring.
- `IconActionButtonGroup` (`src/components/ui/icon-action-button-group.tsx`) keeps 8px spacing and vertical alignment; it also adapts to mobile when you add `flex-1`.
- Replace any `Button variant="ghost" size="icon"` usage with this component (codemod/lint rule TODO).

### 3.3 Segmented Control
- `SegmentedControl` groups filters such as coverage/deliverable selectors or session views. Use `renderSegmentLabel()` helpers (see `UpcomingSessions.tsx`) for labels with counts.
- Wrap in `overflow-x-auto` containers when many options exist (mobile support in sessions page).

### 3.4 Tables & Lists
- Use `Table` components from `src/components/ui/table.tsx` to inherit spacing/padding.
- For re-orderable lists, combine `Table` or custom cards with `@hello-pangea/dnd`, as in `LeadFieldsList`. Keep drag handles visually distinct (muted icon that becomes `cursor-grab`).

### 3.5 Collapsible / Accordion
- Apply the shared transition grid wrapper (`grid grid-rows-[0fr] ...`) now used in `ServicesSection` for smoother expansion.
- Trigger area should fill width with `min-h-[44px]` to maintain tap targets.

### 3.6 Badges & Status Chips
- Use `<Badge>` with variants (`default`, `secondary`, `outline`) for short metadata.
- Lifecycle-specific badges (session/lead/project statuses) map to the tokens defined in Tailwind; do not introduce new color combos without updating tokens.

## 4. Forms & Dialogs
- Input components (text, textarea, select, switch) live under `src/components/ui/`. They already handle focus rings and dark mode—import them instead of raw HTML elements.
- `AppSheetModal` standardises sheet-style dialogs (used in settings). Keep footer actions as structured arrays for consistent button ordering.
- Validation copy should use translation keys under `forms` (see `forms.json`).

## 5. Feedback & Notifications
- Toasts use `useToast` / `useI18nToast`. Supply localized `title` & `description` (see Services and Session Types sections for examples).
- Loading skeletons: `FormLoadingSkeleton` and `components/ui/skeleton.tsx` cover most needs; match the shapes of the real content.

## 6. Accessibility & Internationalisation
- Always include `aria-label` or sr-only text on icon-only buttons (see `IconActionButton` usage).
- Keep textual content in translation files. Reuse `useFormsTranslation` / `useCommonTranslation` helpers for settings contexts.
- When counts or currencies are displayed, format via `Intl.NumberFormat` (e.g., `formatCount` helpers) to respect locale.

## 7. Implementation Backlog
- **Lint rule:** add an ESLint custom rule (or extend `@/scripts/lint-rules`) that flags `<Button size="icon">` usage to enforce the `IconActionButton` pattern.
- **Codemod:** write a TS codemod (via `jscodeshift`) that replaces `Button` icon patterns with the new component to accelerate migration.
- **Storybook coverage:** add stories for `IconActionButton`, `SegmentedControl`, `SettingsSection`, and `KpiCard` showing hover, focus, dark mode, and mobile states.
- **Design token doc:** export colors/spacing tokens automatically (e.g., generate a palette section) for quick reference by designers.

## 8. Quick Reference
- Icon Action Buttons: `src/components/ui/icon-action-button.tsx`
- Segmented Control: `src/components/ui/segmented-control.tsx`
- Settings Section: `src/components/SettingsSection.tsx`
- KPI Cards: `src/components/ui/kpi-card.tsx`
- Tables: `src/components/ui/table.tsx`
- Toast Hook: `src/hooks/use-toast.ts`

Keep this README updated when you introduce new primitives or change existing patterns. That way the next feature team can reuse decisions instead of rediscovering them.
