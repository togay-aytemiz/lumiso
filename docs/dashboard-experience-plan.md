# Dashboard Experience Plan

Product inspiration drawn from Dubsado, HoneyBook, Pixieset, and other photographer-focused CRMs that balance concierge guidance for new studios with data visibility for power users.

## Purpose
- Deliver a welcoming but actionable hub that greets the studio owner, highlights the next best actions, and keeps critical business signals within one click.
- Scale from day-one onboarding (low information, helpful guidance) to mature businesses (dense KPIs, configurable charts).
- Reuse existing components (session wizard calendar, KPI cards, project/lead cards) to accelerate implementation and keep the visual language consistent.

## Guiding Principles
- **Contextual warmth**: Personalized greetings with time-of-day tone and emoji microcopy, mirroring HoneyBook's friendly assistant vibe.
- **Progressive density**: Start with a simplified layout and let power users reveal additional modules (chart toggles, KPI grids, filters).
- **Action before analysis**: Every insight block surfaces a primary CTA (schedule session, follow up, view project) to replicate Dubsado's "jump back in" behaviour.
- **Trustworthy data**: Charts and KPIs explicitly state the data window and update cadence; ensure parity between dashboard and detail pages to avoid confusion.
- **Plan-the-day rituals**: Borrow Pixieset's "Today" list concept—always show today's schedule across leads, projects, and sessions in one glance.

## Layout Overview
1. Greeting & Daily Planning strip (full width, stacked on mobile).
2. Key Metrics row (3–4 KPI cards) with quick filter chips.
3. Chart canvas with tabs for Payments, Sessions, Leads, and Projects.
4. Next Focus module (like provided card) summarizing upcoming commitments + task chips.
5. Activity feeds (latest clients, projects, upcoming sessions) in two-column grid.
6. Calendar module (reuse session wizard calendar) with mini planner CTA.

## Greeting & Daily Planning
- Time-aware greeting (`Good morning 🌅 Tay`, `Good evening 🌙 Tay`) plus friendly nudge (e.g., "You have 3 touchpoints waiting").
- Quick day planner chips: "Review today's sessions", "Prep invoices", "Send galleries".
- Micro weather-style emoji cues taken from Dubsado's seasonal headers to keep the brand playful.

## Key Metrics & KPI Cards
- Start with four KPIs: `Pending Payments`, `Sessions This Week`, `Lead Response Time`, `Active Projects`.
- Provide a simple tab switcher (Week / Month / Quarter) to match HoneyBook's cadence controls.
- Each card exposes a secondary action (e.g., `View payments`) and a contextual trend indicator.
- Use the existing `KpiCardExamples.md` as a reference for typography/spacing and extend variants for success, warning, neutral states.

## Chart Canvas
- Responsive container with pill tabs: `Payments`, `Sessions`, `Pipeline`, `Marketing`.
- Each tab renders a purpose-built visualization:
  - **Payments**: stacked bar by status (Paid, Overdue, Upcoming) with quick filter for invoice type.
  - **Sessions**: area + dot overlay showing completed vs scheduled vs cancelled.
  - **Pipeline**: funnel from lead → booked → project → delivered (mirrors Dubsado pipeline board).
  - **Marketing**: line chart of lead sources with top source callout (useful for Pixieset Studio & HoneyBook growth insights).
- Provide `Last 7 / 30 / 90 days` filter tied to backend query parameters; remember user selection.
- Support hover tooltips and "Add to report" CTA for power users.

## Next Focus Module
- Visual language inspired by the supplied mock and HoneyBook's "Next Steps".
- Always display the most urgent upcoming session or overdue task; include:
  - Session summary (client, date/time, session type).
  - CTA: `View lead` or `Open project`.
  - Task counters (Today, Overdue, Upcoming) with color-coded pills.
- Add micro-actions: `Send reminder`, `Mark prepped`, `Reschedule`.

## Latest Activity Feeds
- **Latest 5 Clients**: show avatar/initials, inquiry date, associated project, CTA to open lead.
- **Latest 5 Projects (by update)**: highlight stage, last touch (email sent, payment received), CTA to resume.
- **Upcoming Sessions**: chronological list covering the next week; call out tasks (contract pending, questionnaire open).
- Provide empty-state helper copy guiding new users to create their first lead/project/session.

## Embedded Calendar
- Reuse the session wizard weekly calendar component in read-only mode.
- Default view: current week; allow switching to month without modal reload.
- Clicking a day opens a side panel (or launches the session wizard with preselected date) so users can immediately schedule or inspect sessions.
- Overlay personal events (Google sync, manual blockers) to help plan shoots realistically—mirrors Dubsado's calendar overlay pattern.

## Adoption & Safety Rails
- Offer a "Simplify dashboard" toggle surfaced in Settings for overwhelmed users.
- Tooltips and `Learn more` links point to documentation or onboarding videos.
- Analytics: track module visibility, tab switches, CTA clicks to learn what power users rely on.
- Progressive rollout: guard modules behind feature flags so we can ship incrementally.
- Respect the existing Getting Started onboarding list—new users see a pared-back dashboard with helper copy linking to that checklist instead of surfacing a second list.

## Implementation Checklist
- [ ] Create `DashboardShell` layout with greeting strip, KPI row, chart canvas, focus module, activity feeds, calendar.
- [ ] Implement time-based greeting hook (`useTimeOfDayGreeting`) returning message + emoji.
- [ ] Add KPI card data service with cached API calls and fallback skeleton loaders.
- [ ] Build multi-view chart component with tab + date range controls and Supabase queries per dataset.
- [ ] Recreate "Next Focus" card styled component with CTA slots and task count chips.
- [ ] Surface "Latest Clients" and "Recent Projects" lists with pagination + empty states.
- [ ] Integrate upcoming sessions list tied to calendar data; expose quick scheduling actions.
- [ ] Embed session-wizard calendar in read-only planner mode with date click handler.
- [ ] Add personalization and layout preference storage (per org/user) to remember toggles.
- [ ] Instrument analytics events for greetings, KPI filters, chart view switches, and focus CTAs.

## Rollout Notes
- Ship greeting, KPI cards, and focus module first (low risk, high engagement).
- Add chart canvas and feeds once pipelines are verified.
- Deliver calendar embed last since it relies on session wizard refactor dependencies.
- Schedule usability sessions with both new and power users before finalizing defaults.
