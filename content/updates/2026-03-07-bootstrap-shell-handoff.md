---
id: rel-2026-03-07-bootstrap-shell-handoff
version: v0.0.0
title: "Bootstrap shell handoff keeps the app chrome visible during first load"
date: 2026-03-07
published_at: 2026-03-07T10:55:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Kept the branded header visible through the React handoff and removed the homepage chunk waterfall so first load feels materially faster."
---

## Changes
- [x] [Improved] 🧭 First-load navigation now stays visible while the app hydrates, so opening a page feels faster and less blank.
- [x] [Improved] ⚡ The homepage now loads its above-the-fold route path without the old nested chunk waterfall, so the first real content appears sooner after the initial shell.
- [x] [Improved] 🧳 Trip, shared-trip, and example-trip loading now keep a route-aware top bar on screen until the first real planner view is ready.
- [x] [Fixed] 🧭 Opening another page after the app is already ready no longer replays the first-load navigation skeleton.
- [x] [Fixed] ✨ Follow-up page loads now keep the fallback header sizing and background closer to the live marketing layout, reducing the brief flash during route changes.
- [ ] [Internal] 🧱 Replaced the marketing route fallback with the real React site header and matching brand icon so the bootstrap handoff no longer jumps between different header layouts.
- [ ] [Internal] 🛠️ Fixed the bootstrap container markup so removing the pre-hydration shell no longer tears down the React root during the handoff.
- [ ] [Internal] ⏱️ Moved the bootstrap handoff trigger to the actual resolved route content for marketing and create-trip flows, so the static shell stays in place until the real page is ready to replace it.
- [ ] [Internal] 🚀 Started route-aware chunk preloading before React mounts and moved the homepage route module into the eager path to reduce direct-entry latency without adding more fake skeleton UI.
- [ ] [Internal] 🎛️ Matched the React route fallback to the static bootstrap shell with disabled-looking controls, skeleton nav bars, and a single-logo treatment so the header no longer flips between different visual states during first load.
- [ ] [Internal] 🎨 Tuned the brand badge padding and wordmark gap so the bootstrap shell and live header now match the published logo proportions more closely.
- [ ] [Internal] 🛫 Swapped the scaled favicon for a dedicated white plane glyph inside an explicit indigo badge, so the live header and bootstrap shell now use the same cleaner logo geometry.
- [ ] [Internal] 📱 Matched the bootstrap shell to the live mobile header by keeping the brand badge radius consistent at small sizes and showing the burger control until the desktop navigation breakpoint.
- [ ] [Internal] 🔧 Removed the fake burger-button chrome from the mobile bootstrap shell and locked both the live header and static shell badge to the same fixed 6px corner radius.
- [ ] [Internal] 📐 Tightened the brand badge corner radius and eased the wordmark spacing so the live header and bootstrap shell stay aligned with the published brand lockup.
