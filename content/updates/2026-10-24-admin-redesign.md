---
id: rel-2026-10-24-admin-redesign
version: v0.209.0
title: "A rebuilt admin workspace"
date: 2026-10-24
published_at: 2026-10-24T18:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Every admin screen now runs in one modern shell with a command palette, shared components and themed charts."
---

## Changes
- [ ] [Internal] 🧭 Rebuilt the admin shell: a sidebar pinned to the viewport with its own scroll area (long tables no longer drag the navigation along), collapsible to an icon rail with ⌘B, breadcrumbs in a slim top bar, and one page header for title, search, date range and actions.
- [ ] [Internal] ⌨️ Added a ⌘K command palette that jumps to any admin screen by name or keyword and switches the theme.
- [ ] [Internal] 📱 The admin navigation on narrow screens is now a real dialog sheet with focus trap, Escape and focus return.
- [ ] [Internal] 🗂️ Regrouped the admin navigation into Workspace, Operations, Content and Tools, with sentence-case labels.
- [ ] [Internal] 📊 Replaced Tremor with shadcn charts on Recharts; series colours come from shared chart tokens that keep the same hue order in light and dark.
- [ ] [Internal] 🧱 Added shared admin building blocks — stat card, section header, status badge, empty state, error alert and bar chart — documented in the component catalogue and shown in the design system playground.
- [ ] [Internal] 🏠 Redesigned the admin overview: KPI tiles, a user-mix breakdown, three themed charts and a recent-users table that opens the user drawer without a full page reload.
- [ ] [Internal] 🎨 Migrated every admin screen onto the shared buttons, badges, tables, alerts and panels, with consistent radii, sentence case and no uppercase eyebrow labels.
- [ ] [Internal] 🪜 Fixed responsive layouts that silently stayed in their mobile arrangement: two Tailwind entry sheets shipped in one bundle in the wrong order, so a plain utility from one beat a breakpoint variant from the other. There is now a single Tailwind entry, with a test that keeps it that way.
- [ ] [Internal] 🌗 Fixed unreadable success, warning and error alert text in dark mode: the description kept its light-theme ink on the dark wash.
- [ ] [Internal] 🪟 Hand-rolled overlays in the AI benchmark and the row menus on Users and Trips are now real dialogs and dropdown menus, with focus handling and Escape.
- [ ] [Internal] 🛡️ Every admin screen shows an authored sentence instead of raw database or gateway text when a request fails, through one shared helper; permission, expired-session and network failures get their own sentences, and validation and "re-run the migration" hints still come through.
- [ ] [Internal] 🧷 Fixed a batch of smaller admin bugs: the AI benchmark tab bar sliding under the header, Worker health showing dead search and date filters, Settings showing "Loading…" forever after a failed load, cost-per-day dates a day off west of UTC, invisible provider logos and diff colours in dark mode, mouse-only column resizing on Airports, and a grid template on Trips that never applied.
- [ ] [Internal] 🧊 Frozen table columns stay opaque when a row is selected or sorted, so scrolled columns no longer show through them, and their divider and shadow follow the reading direction.
- [ ] [Internal] 🔁 Switching the country filter on Recommendations can no longer let a slower, older response overwrite the newer list.
- [ ] [Internal] 🐛 Fixed the admin shell throwing on cross-tab storage events because it referenced a constant it never imported.
- [ ] [Internal] 🔓 The local dev admin bypass now also works when the browser already holds an anonymous guest session.
- [ ] [Internal] 🧪 Added coverage for the shell (breadcrumbs, command palette, sidebar collapse, mobile sheet, page filters), the chart primitives and the navigation config.
