---
id: rel-2026-10-18-tanstack-start-migration
version: v0.209.0
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
- [x] [Improved] ⚡ Show landing-page content and translations immediately and keep the first click responsive.
- [x] [Improved] 🧭 Highlight navigation immediately, complete the top loading bar, and use subtle transitions that respect reduced-motion preferences.
- [x] [Fixed] 🌓 Keep the chosen appearance consistent from the first view and when device settings change.
- [x] [Fixed] 🍪 Show outstanding cookie choices immediately, keep them in sync, and avoid interrupting navigation or open dialogs.
- [x] [Improved] 🔑 Keep account access steady, open sign-in directly for guests, and show your trips after signing in.
- [x] [Improved] 🏠 Keep the homepage accessible when signed in, with a direct link to your trips.
- [x] [Improved] 🧳 Open trips with fewer downloads while keeping planning tools available when needed.
- [x] [Fixed] 📝 Preserve open trip details and unfinished planner inputs during background session checks, and remove the retired profile header.
- [x] [Fixed] 📱 Keep mobile language controls accessible without trapping keyboard focus.
- [x] [Improved] 🖼️ Avoid downloading hidden desktop artwork on phones and retry original images when optimized images fail.
- [x] [Fixed] 🌐 Keep language notices above page content, including long translations and smaller screens.
- [x] [Fixed] 📅 Keep publication dates consistent as pages load in different languages and time zones.
- [x] [Fixed] 📶 Keep page titles correct when a slow connection or offline visit follows another page.
- [x] [Fixed] 🗓️ Round trips no longer gain an extra night at their final return stop.
- [ ] [Internal] 🧭 Use native TanStack Start client hydration, routing and document/head ownership, selective SSR and separate public, account, creation, trip and admin boundaries.
- [ ] [Internal] ⚛️ Run native selective SSR on React 19, update drawer compatibility and verify real admin charts without replacing library code in tests.
- [ ] [Internal] 🧪 Record critical-flow regressions, hosted acceptance, successful live round-trip persistence and equivalent before/after benchmarks with exact revisions and limitations.
- [ ] [Internal] 🔐 Isolate request i18n, session-bound caches and permission checks; preserve identity-switch and pending-navigation invalidation.
- [ ] [Internal] 🧩 Keep optional generation, authoring and claim recovery outside ordinary trip viewing, with native required-view preloading and the shared cancellation registry.
- [ ] [Internal] 🌐 Emit and validate 77 native flat public documents with canonical English slugs and locale prefixes.
- [ ] [Internal] ♿ Share overlay scroll-lock ownership and preserve navigation focus across Safari sign-in handoffs.
- [ ] [Internal] 📶 Preserve the neutral install-time offline shell rather than caching another route's document as a shared fallback.
- [ ] [Internal] 🎞️ Preserve current sharing-image/video behavior in the native document head and resolve preview media against its own deployment origin.

- [ ] [Fixed] 🛠️ Fix cold admin route crashes caused by global syntax-highlighter initialization; retain JSON highlighting without global language registration.
