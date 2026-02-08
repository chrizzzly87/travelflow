---
id: rel-2026-02-08-island-destination-and-classic-tooltip
version: v0.18.0
title: "Island Mode: global destination coverage + on-island trip control"
date: 2026-02-08
published_at: 2026-02-08T23:55:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "🥳 Big island-planning upgrade: you can now search hundreds of popular islands worldwide, keep routes on selected islands by default, and still opt out in Advanced Options when needed."
---

## Changes
- [x] [New feature] 🏝️ Added a global island destination dataset (400+ entries) mapped to parent countries and correct flags, including broad Indonesia coverage like Bali, Lombok, Komodo, Raja Ampat, Java, and Sumatra.
- [x] [Improved] 🔎 Create Trip destination search now supports countries + islands from structured JSON, including alias matching (for example Kreta -> Crete).
- [x] [New feature] 🧭 Added default island-only planning mode when an island is selected, with an Advanced Options toggle to allow mainland or non-selected islands when desired.
- [x] [Improved] 🤖 Gemini now receives explicit island context and island-only on/off constraints, so generated routes stay on selected islands by default.
- [x] [Improved] 🗓️ Added the Ideal travel time tooltip to Classic destination chips for parity with other flows.
- [x] [Fixed] ✨ Release note markdown now renders rich formatting (like **bold**, links, and inline code) correctly on News & Updates and the in-app release modal.
- [x] [Improved] 🎉 Huge thanks to **Nico** for this feature request and push for proper island-first planning! 🥳
- [ ] [Internal] Moved island source-of-truth data into `data/popularIslandDestinations.json` and centralized destination resolution helpers for maintainability.
