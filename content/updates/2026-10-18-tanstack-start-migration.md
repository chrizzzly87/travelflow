---
id: rel-2026-10-18-tanstack-start-migration
version: v0.207.0
title: "Application framework migration"
date: 2026-10-18
# Draft placeholder; replace with actual main deployment time before publication.
published_at: 2026-10-18T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Framework migration under development and validation on an isolated preview branch."
---

## Changes
- [ ] [Internal] 🧭 Implement native TanStack Start routing with separate public, account, creation, trip and admin application boundaries.
- [ ] [Internal] 🧪 Track critical-flow regression coverage and equivalent before/after performance measurements before preview acceptance.
- [ ] [Internal] 🛠️ Repair deterministic image hydration and defer the initial auth hint without interrupting public-page hydration.
- [ ] [Internal] 🧩 Split route loaders and preserve the native offline module graph alongside the framework document.
- [ ] [Internal] 🌐 Normalize hosted directory paths before locale and namespace resolution so language changes preserve the current page.
- [ ] [Internal] 🧭 Replace fabricated marketing navigation and auth spinners with usable navigation while native routing prepares the next page.
- [ ] [Internal] 🍪 Synchronize consent controls and recheck analytics consent after asynchronous script loading.
- [ ] [Internal] ⚡ Render primary hero content immediately and record actual mobile Lighthouse evidence.
- [ ] [Internal] 🖱️ Wait for active presses to finish before showing consent overlays during hydration.
- [ ] [Internal] 🔐 Scope session revalidation through native route metadata and preserve initial authenticated hydration and account-switch loading generations.
