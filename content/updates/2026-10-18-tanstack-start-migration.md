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
- [ ] [Internal] 🛠️ Repair deterministic image hydration and publish verified auth state without interrupting public-page hydration.
- [ ] [Internal] 🧩 Split route loaders and preserve the native offline module graph alongside the framework document.
- [ ] [Internal] 🌐 Normalize hosted directory paths before locale and namespace resolution so language changes preserve the current page.
- [x] [Improved] 🧭 Keep navigation usable while pages and sign-in status load.
- [x] [Fixed] 🍪 Keep cookie choices in sync and stop pending analytics when consent is withdrawn.
- [x] [Improved] ⚡ Show essential landing-page content immediately for a faster first view.
- [x] [Fixed] 🖱️ Keep cookie choices from covering open navigation or interrupting clicks while pages load.
- [ ] [Internal] 🔐 Scope session revalidation through native route metadata and preserve initial authenticated hydration and account-switch loading generations.
- [x] [Fixed] 📝 Keep open trip details and unfinished planner inputs when a guest session starts in the background.
- [x] [Fixed] 🌐 Open pages using the translations already delivered with the document, avoiding an extra download that could leave a page unresponsive.
- [x] [Fixed] 🔒 Keep pages usable when the browser blocks access to local preferences.
- [x] [Fixed] 🌓 Keep the chosen appearance consistent from the first view and when device settings change.
- [x] [Improved] 🍪 Show cookie choices immediately when a decision is still needed.
- [x] [Improved] 👤 Keep the account entry steady while sign-in status is checked and show its actions immediately when opened.
- [x] [Fixed] 🌐 Change the language from mobile navigation without keyboard focus getting stuck.
- [x] [Improved] 📱 Avoid downloading hidden desktop artwork on phones.
- [ ] [Internal] 🧩 Separate synchronous trip-generation policy and cancellation from optional authoring and claim-recovery execution.
- [x] [Improved] 🧳 Open trips with fewer downloads while keeping planning tools available when needed.
