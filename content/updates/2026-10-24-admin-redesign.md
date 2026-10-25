---
id: rel-2026-10-24-admin-redesign
version: v0.209.0
title: "A rebuilt admin workspace"
date: 2026-10-24
published_at: 2026-10-24T18:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Every admin screen was rethought around the job it does, in one modern shell with a command palette, shared components and themed charts."
---

## Changes
- [ ] [Internal] 🧭 New admin shell: a sidebar pinned to the viewport (Workspace, Operations, Content, Tools) that collapses to an icon rail with ⌘B, breadcrumbs, one page header for title, filters and actions, and a mobile navigation sheet.
- [ ] [Internal] ⌨️ A ⌘K command palette jumps to any admin screen by name or keyword and switches the theme.
- [ ] [Internal] 🎯 Every screen was rethought around its job, written down in a new screen guide: Overview, Users, Trips and Plans lead with what needs attention (failed generations, accounts awaiting activation, subscriptions at risk, trips expiring this week), and those tiles open the matching filtered list.
- [ ] [Internal] 🧾 Records open in one consistent side sheet, bulk actions appear only while rows are selected, and every table pages the same way; Users, Trips, Audit log and Airports tables fit a laptop screen without sideways scrolling.
- [ ] [Internal] 🗂️ Long screens were split by job: Airports into Catalog, Nearby tester and Ticket lab; AI benchmark into Runs, Compare and Setup (opening on your latest results); Billing into Subscriptions and Webhook events; OG tools opens on the URL inspector.
- [ ] [Internal] 📊 Every admin chart now uses the shared chart set on Recharts (bar, area, donut and a bar list with share-of-total rows); AI telemetry's leaderboards, donut and provider charts became one sortable comparison table and a tabbed trend chart, and Worker health shows one healthy/degraded/failing verdict with the reason.
- [ ] [Internal] 🛡️ Failed requests show an authored sentence instead of raw database or gateway text on every screen, permission, session and network failures get their own sentences, and the AI benchmark endpoint no longer returns raw database messages.
- [ ] [Internal] 🪜 Fixed responsive layouts that silently stayed in their mobile arrangement: two Tailwind entry sheets shipped in one bundle in the wrong order. There is now a single entry, and the entry CSS shrank from about 493 KB to 357 KB.
- [ ] [Internal] 🧷 Fixed data-safety bugs: Destinations no longer wipes a guide's override when the first guide is saved, Recommendations' "Publish now" keeps unsaved edits, Users no longer writes audit rows for unchanged trip expiry, deleted users no longer reopen from a stale link, Trips' select-all no longer reaches rows on other pages, and Plans asks before reapplying limits to existing customers.
- [ ] [Internal] 🔁 Ported the redesign onto TanStack Start and React 19, and fixed two regressions the move exposed: an endless URL rewrite loop on Airports when the tester opened, and links marked as the current page on their child routes.
- [ ] [Internal] 🐛 Fixed a batch of smaller bugs: unreadable alerts in dark mode, see-through frozen table columns, keyboard-inaccessible filter menus, errors hidden behind open sheets, the Audit action filter hiding newer actions, a stale-response race on Recommendations, and a shell crash on cross-tab storage events.
- [ ] [Internal] ✨ Motion follows one set of rules: no animation on keyboard actions, short ease-out entrances, press feedback on buttons, reduced motion respected.
- [ ] [Internal] 📚 Updated the admin docs (screen guide, design contract, component catalogue, analytics events, runbooks) and added tests for the shell, the shared admin components and every reworked screen.
