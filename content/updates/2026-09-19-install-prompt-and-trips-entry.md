---
id: rel-2026-09-19-install-prompt-and-trips-entry
version: v0.176.0
title: "A nudge to install, and a roomier trips list on your phone"
date: 2026-09-19
published_at: 2026-09-19T09:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Nothing told you TravelFlow could live on your home screen, so now a small card mentions it once you have a trip worth carrying — and on a phone, My Trips opens as a full page instead of a narrow drawer."
---

## Changes
- [x] [New feature] 🏠 A small card now offers to put TravelFlow on your home screen, so you can find the offline app at all. It waits until you have a trip worth carrying, appears only on your trips or a trip itself, and goes away for good if you say no twice.
- [x] [Improved] 📖 On a phone, My Trips now opens as a full page instead of a narrow side drawer, so you can actually read your list. On a larger screen it still slides in over your work, where glancing without losing your place is the point.
- [x] [Fixed] 🇩🇪 The trips list spoke English on translated pages — the search box, the empty message and the Favourites and Your trips headings are now in your language.
- [ ] [Internal] Added `services/installPromptService.ts` (pure eligibility policy, dismissal state, platform detection) and `components/InstallAppBanner.tsx`.
- [ ] [Internal] On Android the banner renders only after `beforeinstallprompt` fires; without that signal we cannot know where a given browser hides install, and iOS Share-sheet wording would be wrong.
- [ ] [Internal] `openTripManager` in `App.tsx` is the single branch point for overlay vs route, so every "My Trips" entry point stays consistent.
- [ ] [Internal] `pr-quality` now runs `pnpm test:e2e:pwa` after the existing build gate, reusing that build's `dist/` rather than producing a second one, and uploads the Playwright report on failure.
